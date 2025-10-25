'use client';

import { Info, Pause, Play, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import PageLayout from '@/components/PageLayout';

// 游戏配置
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const CELL_SIZE = 30;
const INITIAL_SPEED = 1000;
const SPEED_INCREMENT = 50;
const POINTS_PER_LINE = 100;

// 方块形状定义
type TetrominoShape = number[][];

interface Tetromino {
  shape: TetrominoShape;
  color: string;
}

const TETROMINOS: Record<string, Tetromino> = {
  I: {
    shape: [[1, 1, 1, 1]],
    color: '#00f0f0',
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: '#f0f000',
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    color: '#a000f0',
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    color: '#00f000',
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    color: '#f00000',
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    color: '#0000f0',
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
    color: '#f0a000',
  },
};

type Board = (string | null)[][];

interface Position {
  x: number;
  y: number;
}

interface Piece {
  shape: TetrominoShape;
  color: string;
  position: Position;
}

const createEmptyBoard = (): Board => {
  return Array(BOARD_HEIGHT)
    .fill(null)
    .map(() => Array(BOARD_WIDTH).fill(null));
};

const getRandomTetromino = (): Tetromino => {
  const pieces = Object.keys(TETROMINOS);
  const randomPiece = pieces[Math.floor(Math.random() * pieces.length)];
  return TETROMINOS[randomPiece];
};

const rotatePiece = (shape: TetrominoShape): TetrominoShape => {
  const rows = shape.length;
  const cols = shape[0].length;
  const rotated: TetrominoShape = [];

  for (let col = 0; col < cols; col++) {
    const newRow: number[] = [];
    for (let row = rows - 1; row >= 0; row--) {
      newRow.push(shape[row][col]);
    }
    rotated.push(newRow);
  }

  return rotated;
};

export default function TetrisPage() {
  const [board, setBoard] = useState<Board>(createEmptyBoard());
  const [currentPiece, setCurrentPiece] = useState<Piece | null>(null);
  const [nextPiece, setNextPiece] = useState<Tetromino | null>(null);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [clearedLines, setClearedLines] = useState<number[]>([]);

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const checkCollision = useCallback(
    (piece: Piece, board: Board, offset: Position = { x: 0, y: 0 }): boolean => {
      for (let row = 0; row < piece.shape.length; row++) {
        for (let col = 0; col < piece.shape[row].length; col++) {
          if (piece.shape[row][col]) {
            const newX = piece.position.x + col + offset.x;
            const newY = piece.position.y + row + offset.y;

            if (
              newX < 0 ||
              newX >= BOARD_WIDTH ||
              newY >= BOARD_HEIGHT ||
              (newY >= 0 && board[newY][newX])
            ) {
              return true;
            }
          }
        }
      }
      return false;
    },
    []
  );

  const mergePieceToBoard = useCallback((piece: Piece, board: Board): Board => {
    const newBoard = board.map((row) => [...row]);
    for (let row = 0; row < piece.shape.length; row++) {
      for (let col = 0; col < piece.shape[row].length; col++) {
        if (piece.shape[row][col]) {
          const y = piece.position.y + row;
          const x = piece.position.x + col;
          if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
            newBoard[y][x] = piece.color;
          }
        }
      }
    }
    return newBoard;
  }, []);

  const clearLines = useCallback(
    (board: Board): { newBoard: Board; linesCleared: number; clearedIndices: number[] } => {
      const linesToClear: number[] = [];

      for (let row = 0; row < BOARD_HEIGHT; row++) {
        if (board[row].every((cell) => cell !== null)) {
          linesToClear.push(row);
        }
      }

      if (linesToClear.length === 0) {
        return { newBoard: board, linesCleared: 0, clearedIndices: [] };
      }

      const newBoard = board.filter((_, index) => !linesToClear.includes(index));
      const emptyRows = Array(linesToClear.length)
        .fill(null)
        .map(() => Array(BOARD_WIDTH).fill(null));

      return {
        newBoard: [...emptyRows, ...newBoard],
        linesCleared: linesToClear.length,
        clearedIndices: linesToClear,
      };
    },
    []
  );

  const spawnNewPiece = useCallback(() => {
    const tetromino = nextPiece || getRandomTetromino();
    const newPiece: Piece = {
      shape: tetromino.shape,
      color: tetromino.color,
      position: {
        x: Math.floor(BOARD_WIDTH / 2) - Math.floor(tetromino.shape[0].length / 2),
        y: 0,
      },
    };

    setNextPiece(getRandomTetromino());

    if (checkCollision(newPiece, board)) {
      setGameOver(true);
      return null;
    }

    return newPiece;
  }, [nextPiece, board, checkCollision]);

  const movePiece = useCallback(
    (direction: 'left' | 'right' | 'down') => {
      if (!currentPiece || gameOver || isPaused) return;

      const offset = {
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 },
        down: { x: 0, y: 1 },
      }[direction];

      if (!checkCollision(currentPiece, board, offset)) {
        setCurrentPiece({
          ...currentPiece,
          position: {
            x: currentPiece.position.x + offset.x,
            y: currentPiece.position.y + offset.y,
          },
        });
      } else if (direction === 'down') {
        const newBoard = mergePieceToBoard(currentPiece, board);
        const { newBoard: clearedBoard, linesCleared, clearedIndices } = clearLines(newBoard);

        if (linesCleared > 0) {
          setClearedLines(clearedIndices);
          setTimeout(() => {
            setBoard(clearedBoard);
            setScore((_prev) => _prev + linesCleared * POINTS_PER_LINE);
            setLevel((_prev) => Math.floor((score + linesCleared * POINTS_PER_LINE) / 500) + 1);
            setClearedLines([]);
          }, 300);
        } else {
          setBoard(clearedBoard);
        }

        const newPiece = spawnNewPiece();
        setCurrentPiece(newPiece);
      }
    },
    [currentPiece, gameOver, isPaused, board, checkCollision, mergePieceToBoard, clearLines, spawnNewPiece, score]
  );

  const rotatePieceHandler = useCallback(() => {
    if (!currentPiece || gameOver || isPaused) return;

    const rotated = rotatePiece(currentPiece.shape);
    const rotatedPiece = { ...currentPiece, shape: rotated };

    if (!checkCollision(rotatedPiece, board)) {
      setCurrentPiece(rotatedPiece);
    } else {
      // 尝试墙壁踢
      const kicks = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 2, y: 0 },
        { x: -2, y: 0 },
      ];

      for (const kick of kicks) {
        const kickedPiece = {
          ...rotatedPiece,
          position: {
            x: currentPiece.position.x + kick.x,
            y: currentPiece.position.y + kick.y,
          },
        };

        if (!checkCollision(kickedPiece, board)) {
          setCurrentPiece(kickedPiece);
          return;
        }
      }
    }
  }, [currentPiece, gameOver, isPaused, board, checkCollision]);

  const hardDrop = useCallback(() => {
    if (!currentPiece || gameOver || isPaused) return;

    let dropDistance = 0;
    while (!checkCollision(currentPiece, board, { x: 0, y: dropDistance + 1 })) {
      dropDistance++;
    }

    const droppedPiece = {
      ...currentPiece,
      position: {
        x: currentPiece.position.x,
        y: currentPiece.position.y + dropDistance,
      },
    };

    const newBoard = mergePieceToBoard(droppedPiece, board);
    const { newBoard: clearedBoard, linesCleared, clearedIndices } = clearLines(newBoard);

    if (linesCleared > 0) {
      setClearedLines(clearedIndices);
      setTimeout(() => {
        setBoard(clearedBoard);
        setScore((_prev) => _prev + linesCleared * POINTS_PER_LINE);
        setLevel((_prev) => Math.floor((score + linesCleared * POINTS_PER_LINE) / 500) + 1);
        setClearedLines([]);
      }, 300);
    } else {
      setBoard(clearedBoard);
    }

    const newPiece = spawnNewPiece();
    setCurrentPiece(newPiece);
  }, [currentPiece, gameOver, isPaused, board, checkCollision, mergePieceToBoard, clearLines, spawnNewPiece, score]);

  const resetGame = useCallback(() => {
    setBoard(createEmptyBoard());
    setScore(0);
    setLevel(1);
    setGameOver(false);
    setIsPaused(false);
    setClearedLines([]);
    const firstPiece = getRandomTetromino();
    setNextPiece(getRandomTetromino());
    setCurrentPiece({
      shape: firstPiece.shape,
      color: firstPiece.color,
      position: {
        x: Math.floor(BOARD_WIDTH / 2) - Math.floor(firstPiece.shape[0].length / 2),
        y: 0,
      },
    });
  }, []);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameOver || isPaused) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          movePiece('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          movePiece('right');
          break;
        case 'ArrowDown':
          e.preventDefault();
          movePiece('down');
          break;
        case 'ArrowUp':
        case ' ':
          e.preventDefault();
          rotatePieceHandler();
          break;
        case 'Enter':
          e.preventDefault();
          hardDrop();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [movePiece, rotatePieceHandler, hardDrop, gameOver, isPaused]);

  useEffect(() => {
    if (!currentPiece && !gameOver) {
      resetGame();
    }
  }, [currentPiece, gameOver, resetGame]);

  useEffect(() => {
    if (gameOver || isPaused || !currentPiece) return;

    const speed = Math.max(INITIAL_SPEED - (level - 1) * SPEED_INCREMENT, 100);

    gameLoopRef.current = setInterval(() => {
      movePiece('down');
    }, speed);

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [level, gameOver, isPaused, currentPiece, movePiece]);

  const renderBoard = () => {
    const displayBoard = board.map((row) => [...row]);

    if (currentPiece) {
      for (let row = 0; row < currentPiece.shape.length; row++) {
        for (let col = 0; col < currentPiece.shape[row].length; col++) {
          if (currentPiece.shape[row][col]) {
            const y = currentPiece.position.y + row;
            const x = currentPiece.position.x + col;
            if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
              displayBoard[y][x] = currentPiece.color;
            }
          }
        }
      }
    }

    return displayBoard.map((row, rowIndex) => (
      <div key={rowIndex} className='flex'>
        {row.map((cell, colIndex) => {
          const isClearing = clearedLines.includes(rowIndex);
          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`border border-gray-300 dark:border-gray-700 transition-all duration-300 ${
                isClearing ? 'animate-pulse bg-white dark:bg-white' : ''
              }`}
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                backgroundColor: isClearing ? undefined : cell || '#1a1a1a',
                boxShadow: cell && !isClearing ? 'inset 0 0 0 2px rgba(255,255,255,0.1)' : undefined,
              }}
            />
          );
        })}
      </div>
    ));
  };

  const renderNextPiece = () => {
    if (!nextPiece) return null;

    const maxSize = 4;
    const paddedShape = Array(maxSize)
      .fill(null)
      .map(() => Array(maxSize).fill(0));

    const offsetY = Math.floor((maxSize - nextPiece.shape.length) / 2);
    const offsetX = Math.floor((maxSize - nextPiece.shape[0].length) / 2);

    for (let row = 0; row < nextPiece.shape.length; row++) {
      for (let col = 0; col < nextPiece.shape[row].length; col++) {
        paddedShape[row + offsetY][col + offsetX] = nextPiece.shape[row][col];
      }
    }

    return paddedShape.map((row, rowIndex) => (
      <div key={rowIndex} className='flex'>
        {row.map((cell, colIndex) => (
          <div
            key={`${rowIndex}-${colIndex}`}
            className='border border-gray-300 dark:border-gray-700'
            style={{
              width: 20,
              height: 20,
              backgroundColor: cell ? nextPiece.color : '#1a1a1a',
              boxShadow: cell ? 'inset 0 0 0 1px rgba(255,255,255,0.1)' : undefined,
            }}
          />
        ))}
      </div>
    ));
  };

  const handleTouchStart = useRef({ x: 0, y: 0, time: 0 });

  const onTouchStart = (e: React.TouchEvent) => {
    handleTouchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - handleTouchStart.current.x;
    const deltaY = e.changedTouches[0].clientY - handleTouchStart.current.y;
    const deltaTime = Date.now() - handleTouchStart.current.time;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
          movePiece('right');
        } else {
          movePiece('left');
        }
      }
    } else {
      if (deltaY > 50) {
        movePiece('down');
      } else if (Math.abs(deltaY) < 10 && deltaTime < 200) {
        rotatePieceHandler();
      }
    }
  };

  return (
    <PageLayout activePath='/tetris'>
      <div className='min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black px-4 py-8'>
        <div className='max-w-6xl mx-auto'>
          <h1 className='text-3xl sm:text-4xl font-bold text-center mb-8 text-gray-800 dark:text-gray-100'>
            俄罗斯方块
          </h1>

          <div className='flex flex-col lg:flex-row gap-8 items-start justify-center'>
            <div className='flex flex-col items-center gap-4'>
              <div
                ref={boardRef}
                className='bg-black border-4 border-gray-700 dark:border-gray-600 rounded-lg shadow-2xl relative'
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                style={{
                  touchAction: 'none',
                }}
              >
                {renderBoard()}
                {gameOver && (
                  <div className='absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg'>
                    <div className='text-center'>
                      <p className='text-3xl font-bold text-white mb-4'>游戏结束</p>
                      <p className='text-xl text-gray-300 mb-4'>得分: {score}</p>
                      <button
                        onClick={resetGame}
                        className='px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors'
                      >
                        重新开始
                      </button>
                    </div>
                  </div>
                )}
                {isPaused && !gameOver && (
                  <div className='absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg'>
                    <p className='text-3xl font-bold text-white'>暂停</p>
                  </div>
                )}
              </div>

              <div className='flex gap-2 flex-wrap justify-center'>
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  disabled={gameOver}
                  className='flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white rounded-lg font-semibold transition-colors'
                >
                  {isPaused ? (
                    <>
                      <Play size={18} />
                      <span>继续</span>
                    </>
                  ) : (
                    <>
                      <Pause size={18} />
                      <span>暂停</span>
                    </>
                  )}
                </button>
                <button
                  onClick={resetGame}
                  className='flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors'
                >
                  <RotateCcw size={18} />
                  <span>重新开始</span>
                </button>
                <button
                  onClick={() => setShowInstructions(!showInstructions)}
                  className='flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors'
                >
                  <Info size={18} />
                  <span>说明</span>
                </button>
              </div>
            </div>

            <div className='flex flex-col gap-4 w-full lg:w-auto'>
              <div className='bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg'>
                <h2 className='text-xl font-bold mb-4 text-gray-800 dark:text-gray-100'>游戏信息</h2>
                <div className='space-y-3'>
                  <div>
                    <p className='text-sm text-gray-600 dark:text-gray-400'>得分</p>
                    <p className='text-3xl font-bold text-blue-600 dark:text-blue-400'>{score}</p>
                  </div>
                  <div>
                    <p className='text-sm text-gray-600 dark:text-gray-400'>等级</p>
                    <p className='text-2xl font-bold text-green-600 dark:text-green-400'>{level}</p>
                  </div>
                </div>
              </div>

              <div className='bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg'>
                <h2 className='text-xl font-bold mb-4 text-gray-800 dark:text-gray-100'>下一个</h2>
                <div className='flex justify-center'>{renderNextPiece()}</div>
              </div>

              {showInstructions && (
                <div className='bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg'>
                  <h2 className='text-xl font-bold mb-4 text-gray-800 dark:text-gray-100'>操作说明</h2>
                  <div className='space-y-2 text-sm text-gray-700 dark:text-gray-300'>
                    <div>
                      <p className='font-semibold text-gray-800 dark:text-gray-200'>键盘控制:</p>
                      <ul className='mt-2 space-y-1 ml-4'>
                        <li>← → : 左右移动</li>
                        <li>↓ : 加速下落</li>
                        <li>↑ 或 空格 : 旋转</li>
                        <li>Enter : 快速下落</li>
                      </ul>
                    </div>
                    <div className='mt-4'>
                      <p className='font-semibold text-gray-800 dark:text-gray-200'>触摸控制:</p>
                      <ul className='mt-2 space-y-1 ml-4'>
                        <li>左右滑动: 移动方块</li>
                        <li>下滑: 加速下落</li>
                        <li>点击: 旋转方块</li>
                      </ul>
                    </div>
                    <div className='mt-4'>
                      <p className='font-semibold text-gray-800 dark:text-gray-200'>游戏规则:</p>
                      <ul className='mt-2 space-y-1 ml-4'>
                        <li>消除一行得 100 分</li>
                        <li>每 500 分升一级</li>
                        <li>等级越高速度越快</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
