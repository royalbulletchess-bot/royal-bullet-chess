'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Chess, Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import type { PlayerColor } from '@/types';

interface ChessBoardProps {
  fen: string;
  playerColor: PlayerColor;
  isMyTurn: boolean;
  isGameOver: boolean;
  onMove: (from: string, to: string, promotion?: string) => boolean;
  premoveEnabled?: boolean;
  lastMove?: { from: string; to: string } | null;
}

interface PremoveData {
  from: string;
  to: string;
}

export default function ChessBoard({
  fen,
  playerColor,
  isMyTurn,
  isGameOver,
  onMove,
  premoveEnabled = false,
  lastMove = null,
}: ChessBoardProps) {
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [premove, setPremove] = useState<PremoveData | null>(null);
  const [premoveSquares, setPremoveSquares] = useState<Record<string, React.CSSProperties>>({});
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [boardWidth, setBoardWidth] = useState(350);
  const containerRef = useRef<HTMLDivElement>(null);
  const premoveRef = useRef<PremoveData | null>(null);

  premoveRef.current = premove;

  const boardOrientation = playerColor === 'WHITE' ? 'white' : 'black';
  const myColor = playerColor === 'WHITE' ? 'w' : 'b';

  const game = useMemo(() => new Chess(fen), [fen]);
  const activeColor = game.turn();

  // Check indicator: find king square when in check
  const checkSquare = useMemo(() => {
    if (!game.inCheck()) return null;
    const board = game.board();
    const kingColor = game.turn();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === kingColor) {
          const file = String.fromCharCode(97 + c);
          const rank = String(8 - r);
          return `${file}${rank}`;
        }
      }
    }
    return null;
  }, [game]);

  // Measure container width
  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        if (width > 0) setBoardWidth(width);
      }
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const clearPremove = useCallback(() => {
    setPremove(null);
    setPremoveSquares({});
  }, []);

  // Premove auto-execution
  useEffect(() => {
    if (!premoveEnabled || !isMyTurn || isGameOver) return;
    if (!premoveRef.current) return;

    const { from, to } = premoveRef.current;
    clearPremove();

    const testGame = new Chess(fen);
    try {
      const move = testGame.move({ from, to, promotion: 'q' });
      if (move) {
        queueMicrotask(() => {
          onMove(from, to, 'q');
        });
      }
    } catch {
      // Invalid move, silently discard
    }
  }, [fen, isMyTurn, isGameOver, premoveEnabled, onMove, clearPremove]);

  const getPremoveOptions = useCallback(
    (square: string) => {
      const piece = game.get(square as Square);
      if (!piece || piece.color !== myColor) return false;

      const tempFen = fen.replace(/ [wb] /, ` ${myColor} `);
      try {
        const tempGame = new Chess(tempFen);
        const moves = tempGame.moves({ square: square as Square, verbose: true });
        if (moves.length === 0) return false;

        const newSquares: Record<string, React.CSSProperties> = {};
        moves.forEach((move) => {
          newSquares[move.to] = {
            background:
              tempGame.get(move.to as Square) &&
              tempGame.get(move.to as Square)!.color !== myColor
                ? 'radial-gradient(circle, rgba(37, 99, 235, 0.3) 85%, transparent 85%)'
                : 'radial-gradient(circle, rgba(37, 99, 235, 0.3) 25%, transparent 25%)',
            borderRadius: '50%',
          };
        });
        newSquares[square] = {
          background: 'rgba(37, 99, 235, 0.4)',
        };
        setOptionSquares(newSquares);
        return true;
      } catch {
        return false;
      }
    },
    [game, fen, myColor]
  );

  const setPremoveHighlight = useCallback((from: string, to: string) => {
    setPremove({ from, to });
    setPremoveSquares({
      [from]: { background: 'rgba(37, 99, 235, 0.5)' },
      [to]: { background: 'rgba(37, 99, 235, 0.5)' },
    });
    setOptionSquares({});
    setMoveFrom(null);
  }, []);

  const getMoveOptions = useCallback(
    (square: string) => {
      const moves = game.moves({ square: square as Square, verbose: true });
      if (moves.length === 0) {
        setOptionSquares({});
        return false;
      }

      const newSquares: Record<string, React.CSSProperties> = {};
      moves.forEach((move) => {
        newSquares[move.to] = {
          background:
            game.get(move.to as Square) &&
            game.get(move.to as Square)!.color !== game.get(square as Square)!.color
              ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)'
              : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
          borderRadius: '50%',
        };
      });
      newSquares[square] = {
        background: 'rgba(255, 255, 0, 0.4)',
      };
      setOptionSquares(newSquares);
      return true;
    },
    [game]
  );

  // Promotion check: is this move a pawn promotion?
  const isPromotionMove = useCallback(
    (sourceSquare: string, targetSquare: string, piece: string): boolean => {
      const isPawn = piece[1] === 'P';
      const isPromoRank =
        (piece[0] === 'w' && targetSquare[1] === '8') ||
        (piece[0] === 'b' && targetSquare[1] === '1');
      return isPawn && isPromoRank;
    },
    []
  );

  function onSquareClick(square: string) {
    if (isGameOver) return;

    // Normal move mode (my turn)
    if (isMyTurn) {
      if (premove) clearPremove();

      if (!moveFrom) {
        const piece = game.get(square as Square);
        if (piece && piece.color === activeColor) {
          setMoveFrom(square);
          getMoveOptions(square);
        }
        return;
      }

      // Check for promotion before making the move
      const piece = game.get(moveFrom as Square);
      if (piece) {
        const pieceStr = `${piece.color === 'w' ? 'w' : 'b'}${piece.type.toUpperCase()}`;
        if (isPromotionMove(moveFrom, square, pieceStr)) {
          setPendingPromotion({ from: moveFrom, to: square });
          setMoveFrom(null);
          setOptionSquares({});
          return;
        }
      }

      const success = onMove(moveFrom, square);
      if (!success) {
        const clickedPiece = game.get(square as Square);
        if (clickedPiece && clickedPiece.color === activeColor) {
          setMoveFrom(square);
          getMoveOptions(square);
          return;
        }
      }
      setMoveFrom(null);
      setOptionSquares({});
      return;
    }

    // Premove mode (not my turn, premove enabled)
    if (premoveEnabled) {
      if (!moveFrom) {
        const piece = game.get(square as Square);
        if (piece && piece.color === myColor) {
          setMoveFrom(square);
          clearPremove();
          getPremoveOptions(square);
        } else {
          clearPremove();
          setOptionSquares({});
        }
        return;
      }

      const piece = game.get(square as Square);
      if (piece && piece.color === myColor) {
        setMoveFrom(square);
        clearPremove();
        getPremoveOptions(square);
        return;
      }

      setPremoveHighlight(moveFrom, square);
      return;
    }
  }

  function onPieceDrop(sourceSquare: string, targetSquare: string, piece: string): boolean {
    if (isGameOver) return false;

    if (isMyTurn) {
      if (premove) clearPremove();

      // Check for promotion
      if (isPromotionMove(sourceSquare, targetSquare, piece)) {
        setPendingPromotion({ from: sourceSquare, to: targetSquare });
        return true;
      }

      const success = onMove(sourceSquare, targetSquare);
      setMoveFrom(null);
      setOptionSquares({});
      return success;
    }

    // Premove via drag-and-drop
    if (premoveEnabled) {
      const p = game.get(sourceSquare as Square);
      if (p && p.color === myColor) {
        setPremoveHighlight(sourceSquare, targetSquare);
        return true;
      }
    }

    return false;
  }

  const handlePromotionPieceSelect = useCallback(
    (piece?: string): boolean => {
      if (!piece || !pendingPromotion) {
        setPendingPromotion(null);
        return false;
      }
      const { from, to } = pendingPromotion;
      const promotionPiece = piece[1].toLowerCase();
      const success = onMove(from, to, promotionPiece);
      setPendingPromotion(null);
      return success;
    },
    [pendingPromotion, onMove]
  );

  function onSquareRightClick() {
    if (premove) {
      clearPremove();
      setMoveFrom(null);
      setOptionSquares({});
    }
    if (pendingPromotion) {
      setPendingPromotion(null);
    }
  }

  // Build square styles with priority: lastMove < check < options < premove
  const lastMoveStyles: Record<string, React.CSSProperties> = {};
  if (lastMove) {
    const highlight = { background: 'rgba(255, 255, 0, 0.3)' };
    lastMoveStyles[lastMove.from] = highlight;
    lastMoveStyles[lastMove.to] = highlight;
  }

  const checkStyles: Record<string, React.CSSProperties> = {};
  if (checkSquare) {
    checkStyles[checkSquare] = {
      background:
        'radial-gradient(ellipse at center, rgba(255, 0, 0, 0.6) 0%, rgba(200, 0, 0, 0.3) 40%, rgba(255, 0, 0, 0) 70%)',
    };
  }

  const customSquareStyles = {
    ...lastMoveStyles,
    ...checkStyles,
    ...optionSquares,
    ...premoveSquares,
  };

  const arePiecesDraggable = !isGameOver && (isMyTurn || premoveEnabled);

  return (
    <div ref={containerRef} className="w-full aspect-square">
      <Chessboard
        id="rbc-board"
        position={fen}
        boardWidth={boardWidth}
        onPieceDrop={onPieceDrop}
        onSquareClick={onSquareClick}
        onSquareRightClick={onSquareRightClick}
        boardOrientation={boardOrientation}
        customSquareStyles={customSquareStyles}
        customDarkSquareStyle={{ backgroundColor: '#779952' }}
        customLightSquareStyle={{ backgroundColor: '#edeed1' }}
        animationDuration={150}
        arePiecesDraggable={arePiecesDraggable}
        isDraggablePiece={({ piece }) => piece.startsWith(myColor)}
        promotionToSquare={(pendingPromotion?.to as Square) ?? null}
        onPromotionPieceSelect={handlePromotionPieceSelect}
        promotionDialogVariant="modal"
      />
    </div>
  );
}
