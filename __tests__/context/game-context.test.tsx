import { useContext } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import GameProvider, { GameContext } from "@/context/game-context";
import Board from "@/components/board";
import Score from "@/components/score";
import { mergeAnimationDuration } from "@/constants";

// Lets a test start the provider from a hand-made game state. When it is
// undefined the real initial state is used.
let mockInitialState: Record<string, unknown> | undefined;

// jest.mock needs a relative path: the "@/" alias is not known to jest's resolver
jest.mock("../../reducers/game-reducer", () => {
  const actual = jest.requireActual("../../reducers/game-reducer");

  return {
    __esModule: true,
    ...actual,
    get initialState() {
      return mockInitialState ?? actual.initialState;
    },
  };
});

// A full 4x4 board where valueAt(x, y) gives the value of each tile.
const fullBoardState = (valueAt: (x: number, y: number) => number) => {
  const board: string[][] = [];
  const tiles: Record<string, unknown> = {};
  const tilesByIds: string[] = [];

  for (let x = 0; x < 4; x++) {
    board[x] = [];
    for (let y = 0; y < 4; y++) {
      const id = `t${x}${y}`;
      board[x][y] = id;
      tiles[id] = { id, position: [y, x], value: valueAt(x, y) };
      tilesByIds.push(id);
    }
  }

  return {
    board,
    tiles,
    tilesByIds,
    hasChanged: false,
    score: 0,
    status: "ongoing",
  };
};

// No two neighbours share a value, so no move is possible.
const stuckValue = (x: number, y: number) => ((x + y) % 2 === 0 ? 2 : 4);

function StatusProbe() {
  const { status } = useContext(GameContext);

  return <div data-testid="status">{status}</div>;
}

function TileCountProbe() {
  const { getTiles } = useContext(GameContext);

  return <div data-testid="tile-count">{getTiles().length}</div>;
}

afterEach(() => {
  mockInitialState = undefined;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("GameProvider", () => {
  describe("startGame", () => {
    it("should start the game with two tiles", () => {
      const { container } = render(
        <GameProvider>
          <Board />
        </GameProvider>,
      );

      expect(container.querySelectorAll(".tile")).toHaveLength(2);
    });
  });

  describe("getTiles", () => {
    it("should return tiles", () => {
      const { container } = render(
        <GameProvider>
          <Board />
        </GameProvider>,
      );

      expect(container.querySelectorAll(".tile")).toHaveLength(2);
    });
  });

  describe("moveTiles", () => {
    it("should move tiles and merge them together", () => {
      const { container } = render(
        <GameProvider>
          <Board />
        </GameProvider>,
      );

      expect(container.querySelectorAll(".tile4")).toHaveLength(0);
      expect(container.querySelectorAll(".tile2")).toHaveLength(2);

      fireEvent.keyDown(container, {
        key: "ArrowUp",
        code: "ArrowUp",
      });

      expect(container.querySelectorAll(".tile4")).toHaveLength(1);
      expect(container.querySelectorAll(".tile2")).toHaveLength(1);
    });

    it("should ignore a second move made during the move animation", () => {
      jest.useFakeTimers();
      jest.spyOn(Math, "random").mockReturnValue(0);
      const { container } = render(
        <GameProvider>
          <Board />
        </GameProvider>,
      );
      const mergedTileTop = () =>
        (container.querySelector(".tile4") as HTMLElement).style.top;

      fireEvent.keyDown(window, { code: "ArrowUp" });
      expect(mergedTileTop()).toBe("0px");

      // arrives while the first move is still animating
      fireEvent.keyDown(window, { code: "ArrowDown" });
      expect(mergedTileTop()).toBe("0px");

      act(() => {
        jest.advanceTimersByTime(mergeAnimationDuration * 1.05);
      });
      fireEvent.keyDown(window, { code: "ArrowDown" });
      expect(mergedTileTop()).not.toBe("0px");
    });
  });

  describe("new tiles", () => {
    it("should add a random tile once a move has finished animating", () => {
      jest.useFakeTimers();
      const random = jest.spyOn(Math, "random").mockReturnValue(0);
      const { container } = render(
        <GameProvider>
          <Board />
        </GameProvider>,
      );

      fireEvent.keyDown(window, { code: "ArrowUp" });
      expect(random).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(mergeAnimationDuration);
      });

      expect(random).toHaveBeenCalledTimes(1);
      // the merged 4 plus the new 2
      expect(container.querySelectorAll(".tile")).toHaveLength(2);
      expect(container.querySelectorAll(".tile4")).toHaveLength(1);
      expect(container.querySelectorAll(".tile2")).toHaveLength(1);
    });

    it("should only put the new tile on an empty cell", () => {
      jest.useFakeTimers();
      // picks the last empty cell: x = 3, y = 3
      jest.spyOn(Math, "random").mockReturnValue(0.99);
      const { container } = render(
        <GameProvider>
          <Board />
        </GameProvider>,
      );

      fireEvent.keyDown(window, { code: "ArrowUp" });
      act(() => {
        jest.advanceTimersByTime(mergeAnimationDuration);
      });

      const newTile = container.querySelector(".tile2") as HTMLElement;
      expect(newTile.style.left).toBe("216px");
      expect(newTile.style.top).toBe("216px");
    });

    it("should not add a tile when the board is full", () => {
      jest.useFakeTimers();
      const random = jest.spyOn(Math, "random");
      mockInitialState = { ...fullBoardState(stuckValue), hasChanged: true };
      render(
        <GameProvider>
          <TileCountProbe />
        </GameProvider>,
      );

      act(() => {
        jest.advanceTimersByTime(mergeAnimationDuration);
      });

      expect(random).not.toHaveBeenCalled();
      expect(screen.getByTestId("tile-count")).toHaveTextContent("16");
    });
  });

  describe("score", () => {
    it("should return score", () => {
      const { container } = render(
        <GameProvider>
          <Score />
          <Board />
        </GameProvider>,
      );

      expect(container.querySelector(".score > div")?.textContent).toEqual("0");
    });

    it("should refresh score after move", () => {
      const { container } = render(
        <GameProvider>
          <Score />
          <Board />
        </GameProvider>,
      );

      expect(container.querySelector(".score > div")?.textContent).toEqual("0");

      fireEvent.keyDown(container, {
        key: "ArrowUp",
        code: "ArrowUp",
      });

      expect(container.querySelector(".score > div")?.textContent).toEqual("4");
    });
  });

  describe("status", () => {
    it("should start as ongoing", () => {
      render(
        <GameProvider>
          <StatusProbe />
        </GameProvider>,
      );

      expect(screen.getByTestId("status")).toHaveTextContent("ongoing");
    });

    it("should be won once a 2048 tile exists", () => {
      mockInitialState = {
        board: [
          ["a", undefined, undefined, undefined],
          [undefined, undefined, undefined, undefined],
          [undefined, undefined, undefined, undefined],
          [undefined, undefined, undefined, undefined],
        ],
        tiles: { a: { id: "a", position: [0, 0], value: 2048 } },
        tilesByIds: ["a"],
        hasChanged: false,
        score: 0,
        status: "ongoing",
      };
      render(
        <GameProvider>
          <StatusProbe />
        </GameProvider>,
      );

      expect(screen.getByTestId("status")).toHaveTextContent("won");
    });

    it("should be lost when the board is full and nothing can merge", () => {
      mockInitialState = fullBoardState(stuckValue);
      render(
        <GameProvider>
          <StatusProbe />
        </GameProvider>,
      );

      expect(screen.getByTestId("status")).toHaveTextContent("lost");
    });

    it("should stay ongoing when the board has an empty cell", () => {
      const state = fullBoardState(stuckValue);
      state.board[1][1] = undefined as unknown as string;
      mockInitialState = state;
      render(
        <GameProvider>
          <StatusProbe />
        </GameProvider>,
      );

      expect(screen.getByTestId("status")).toHaveTextContent("ongoing");
    });

    it("should stay ongoing when a full board has equal neighbours in a row", () => {
      mockInitialState = fullBoardState((x, y) =>
        x === 1 && y === 0 ? stuckValue(0, 0) : stuckValue(x, y),
      );
      render(
        <GameProvider>
          <StatusProbe />
        </GameProvider>,
      );

      expect(screen.getByTestId("status")).toHaveTextContent("ongoing");
    });

    it("should stay ongoing when a full board has equal neighbours in a column", () => {
      mockInitialState = fullBoardState((x, y) =>
        x === 0 && y === 1 ? stuckValue(0, 0) : stuckValue(x, y),
      );
      render(
        <GameProvider>
          <StatusProbe />
        </GameProvider>,
      );

      expect(screen.getByTestId("status")).toHaveTextContent("ongoing");
    });

    it("should let the player start again after losing", () => {
      mockInitialState = fullBoardState(stuckValue);
      const { container } = render(
        <GameProvider>
          <Board />
        </GameProvider>,
      );
      expect(screen.getByRole("heading", { name: "You lost!" })).toBeVisible();

      fireEvent.click(screen.getByRole("button", { name: "Play again" }));

      expect(screen.queryByRole("heading")).not.toBeInTheDocument();
      expect(container.querySelectorAll(".tile")).toHaveLength(2);
    });
  });

  describe("default context", () => {
    it("should be inert without a provider", () => {
      let value: React.ContextType<typeof GameContext> | undefined;
      const Probe = () => {
        value = useContext(GameContext);
        return null;
      };
      render(<Probe />);

      expect(value?.score).toBe(0);
      expect(value?.status).toBe("ongoing");
      expect(value?.getTiles()).toEqual([]);
      expect(() => value?.moveTiles("move_up")).not.toThrow();
      expect(() => value?.startGame()).not.toThrow();
    });
  });
});
