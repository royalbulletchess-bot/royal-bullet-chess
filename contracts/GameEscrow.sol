// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GameEscrow
 * @notice Escrow contract for Royal Bullet Chess — holds USDC bets and distributes payouts.
 * @dev Uses USDC (6 decimals) on Base. Owner (backend) calls finish/cancel functions.
 */
contract GameEscrow is Ownable, ReentrancyGuard {
    IERC20 public immutable usdc;
    address public treasury;
    uint256 public commissionBps; // basis points (1000 = 10%)

    struct Game {
        address creator;
        address opponent;
        uint256 betAmount;       // in USDC smallest unit (6 decimals)
        uint256 potAmount;       // betAmount * 2
        GameStatus status;
    }

    enum GameStatus {
        EMPTY,
        CREATED,
        ACTIVE,
        FINISHED,
        CANCELLED
    }

    mapping(bytes32 => Game) public games;

    // ── Events ──
    event GameCreated(bytes32 indexed gameId, address indexed creator, uint256 betAmount);
    event GameJoined(bytes32 indexed gameId, address indexed opponent);
    event GameFinished(bytes32 indexed gameId, address indexed winner, uint256 payout, uint256 commission);
    event GameDrawn(bytes32 indexed gameId, uint256 refundEach);
    event GameCancelled(bytes32 indexed gameId, uint256 refundAmount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event CommissionUpdated(uint256 oldBps, uint256 newBps);

    constructor(
        address _usdc,
        address _treasury,
        uint256 _commissionBps
    ) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_treasury != address(0), "Invalid treasury address");
        require(_commissionBps <= 5000, "Commission too high"); // max 50%

        usdc = IERC20(_usdc);
        treasury = _treasury;
        commissionBps = _commissionBps;
    }

    // ── Player Functions ──

    /**
     * @notice Create a new game and deposit the bet amount.
     * @dev Caller must have approved this contract to spend `betAmount` USDC.
     * @param gameId Unique game identifier (UUID as bytes32)
     * @param betAmount Bet amount in USDC smallest unit (6 decimals)
     */
    function createGame(bytes32 gameId, uint256 betAmount) external nonReentrant {
        require(betAmount > 0, "Bet must be > 0");
        require(games[gameId].status == GameStatus.EMPTY, "Game already exists");

        games[gameId] = Game({
            creator: msg.sender,
            opponent: address(0),
            betAmount: betAmount,
            potAmount: betAmount, // will become betAmount * 2 when opponent joins
            status: GameStatus.CREATED
        });

        require(usdc.transferFrom(msg.sender, address(this), betAmount), "USDC transfer failed");

        emit GameCreated(gameId, msg.sender, betAmount);
    }

    /**
     * @notice Join an existing game and deposit the matching bet amount.
     * @dev Caller must have approved this contract to spend the game's betAmount.
     * @param gameId The game to join
     */
    function joinGame(bytes32 gameId) external nonReentrant {
        Game storage game = games[gameId];
        require(game.status == GameStatus.CREATED, "Game not available");
        require(msg.sender != game.creator, "Cannot join own game");

        game.opponent = msg.sender;
        game.potAmount = game.betAmount * 2;
        game.status = GameStatus.ACTIVE;

        require(usdc.transferFrom(msg.sender, address(this), game.betAmount), "USDC transfer failed");

        emit GameJoined(gameId, msg.sender);
    }

    // ── Owner Functions (called by backend) ──

    /**
     * @notice Finish a game with a winner. Sends payout to winner, commission to treasury.
     * @param gameId The game to finish
     * @param winner The winner's address
     */
    function finishGame(bytes32 gameId, address winner) external onlyOwner nonReentrant {
        Game storage game = games[gameId];
        require(game.status == GameStatus.ACTIVE, "Game not active");
        require(
            winner == game.creator || winner == game.opponent,
            "Winner must be a participant"
        );

        game.status = GameStatus.FINISHED;

        uint256 commission = (game.potAmount * commissionBps) / 10000;
        uint256 payout = game.potAmount - commission;

        if (commission > 0) {
            require(usdc.transfer(treasury, commission), "Commission transfer failed");
        }
        require(usdc.transfer(winner, payout), "Payout transfer failed");

        emit GameFinished(gameId, winner, payout, commission);
    }

    /**
     * @notice Finish a game as a draw. Refunds both players equally.
     * @param gameId The game to finish as draw
     */
    function finishDraw(bytes32 gameId) external onlyOwner nonReentrant {
        Game storage game = games[gameId];
        require(game.status == GameStatus.ACTIVE, "Game not active");

        game.status = GameStatus.FINISHED;

        uint256 refundEach = game.betAmount;

        require(usdc.transfer(game.creator, refundEach), "Creator refund failed");
        require(usdc.transfer(game.opponent, refundEach), "Opponent refund failed");

        emit GameDrawn(gameId, refundEach);
    }

    /**
     * @notice Cancel a game and refund the creator (and opponent if they joined).
     * @param gameId The game to cancel
     */
    function cancelGame(bytes32 gameId) external nonReentrant {
        Game storage game = games[gameId];
        require(
            game.status == GameStatus.CREATED || game.status == GameStatus.ACTIVE,
            "Cannot cancel"
        );

        // Only owner or creator can cancel a CREATED game
        if (game.status == GameStatus.CREATED) {
            require(
                msg.sender == owner() || msg.sender == game.creator,
                "Not authorized"
            );
        } else {
            // Only owner can cancel an ACTIVE game
            require(msg.sender == owner(), "Not authorized");
        }

        game.status = GameStatus.CANCELLED;

        // Refund creator
        require(usdc.transfer(game.creator, game.betAmount), "Creator refund failed");

        // Refund opponent if they joined
        if (game.opponent != address(0)) {
            require(usdc.transfer(game.opponent, game.betAmount), "Opponent refund failed");
        }

        emit GameCancelled(gameId, game.betAmount);
    }

    // ── Admin Functions ──

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        emit TreasuryUpdated(treasury, _treasury);
        treasury = _treasury;
    }

    function setCommission(uint256 _commissionBps) external onlyOwner {
        require(_commissionBps <= 5000, "Commission too high");
        emit CommissionUpdated(commissionBps, _commissionBps);
        commissionBps = _commissionBps;
    }

    /**
     * @notice Emergency withdraw — only use if funds are stuck.
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(treasury, amount);
    }

    // ── View Functions ──

    function getGame(bytes32 gameId)
        external
        view
        returns (
            address creator,
            address opponent,
            uint256 betAmount,
            uint256 potAmount,
            GameStatus status
        )
    {
        Game memory game = games[gameId];
        return (game.creator, game.opponent, game.betAmount, game.potAmount, game.status);
    }
}
