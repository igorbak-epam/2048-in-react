import { fireEvent, render, screen } from "@testing-library/react";
import Board from "@/components/board";
import GameProvider, { GameContext } from "@/context/game-context";

describe("Board", () => {
  it("should render board with 16 cells", () => {
    const { container } = render(
      <GameProvider>
        <Board />
      </GameProvider>,
    );
    const cellElements = container.querySelectorAll(".cell");

    expect(cellElements.length).toEqual(16);
  });

  it("should render board with 2 tiles", async () => {
    const { container } = render(
      <GameProvider>
        <Board />
      </GameProvider>,
    );
    const tiles = container.querySelectorAll(".tile");

    expect(tiles.length).toEqual(2);
  });
});

describe("Board with a mocked game context", () => {
  const renderBoard = (overrides = {}) => {
    const value = {
      score: 0,
      status: "ongoing",
      moveTiles: jest.fn(),
      getTiles: () => [],
      startGame: jest.fn(),
      ...overrides,
    };
    const utils = render(
      <GameContext.Provider value={value}>
        <Board />
      </GameContext.Provider>,
    );

    return { ...utils, ...value };
  };

  it("should start the game once on mount", () => {
    const { startGame } = renderBoard();

    expect(startGame).toHaveBeenCalledTimes(1);
  });

  describe("keyboard", () => {
    it.each([
      ["ArrowUp", "move_up"],
      ["ArrowDown", "move_down"],
      ["ArrowLeft", "move_left"],
      ["ArrowRight", "move_right"],
    ])("should move tiles on %s", (code, direction) => {
      const { moveTiles } = renderBoard();

      fireEvent.keyDown(window, { code });

      expect(moveTiles).toHaveBeenCalledTimes(1);
      expect(moveTiles).toHaveBeenCalledWith(direction);
    });

    it("should ignore other keys", () => {
      const { moveTiles } = renderBoard();

      fireEvent.keyDown(window, { code: "KeyA" });

      expect(moveTiles).not.toHaveBeenCalled();
    });

    it("should prevent the default browser behaviour, like scrolling", () => {
      renderBoard();

      // fireEvent returns false when preventDefault was called
      expect(fireEvent.keyDown(window, { code: "ArrowDown" })).toBe(false);
    });

    it("should stop listening to the keyboard after unmount", () => {
      const { moveTiles, unmount } = renderBoard();

      unmount();
      fireEvent.keyDown(window, { code: "ArrowUp" });

      expect(moveTiles).not.toHaveBeenCalled();
    });
  });

  describe("swipe", () => {
    const swipe = (
      target: Element,
      from: [number, number],
      to: [number, number],
    ) => {
      fireEvent.touchStart(target, {
        touches: [{ clientX: from[0], clientY: from[1] }],
      });
      fireEvent.touchEnd(target, {
        changedTouches: [{ clientX: to[0], clientY: to[1] }],
      });
    };

    it.each([
      ["right", [0, 0], [50, 10], "move_right"],
      ["left", [50, 0], [0, 10], "move_left"],
      ["down", [0, 0], [10, 50], "move_down"],
      ["up", [0, 50], [10, 0], "move_up"],
    ] as const)("should move tiles on a swipe %s", (_, from, to, direction) => {
      const { moveTiles, container } = renderBoard();

      swipe(container.querySelector(".board")!, [...from], [...to]);

      expect(moveTiles).toHaveBeenCalledTimes(1);
      expect(moveTiles).toHaveBeenCalledWith(direction);
    });
  });

  describe("splash screen", () => {
    it("should not show a splash while the game is ongoing", () => {
      renderBoard({ status: "ongoing" });

      expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    });

    it("should show the win splash when the game is won", () => {
      renderBoard({ status: "won" });

      expect(
        screen.getByRole("heading", { name: "You won!" }),
      ).toBeInTheDocument();
    });

    it("should show the lose splash when the game is lost", () => {
      renderBoard({ status: "lost" });

      expect(
        screen.getByRole("heading", { name: "You lost!" }),
      ).toBeInTheDocument();
    });

    it("should start a new game from the splash", () => {
      const { startGame } = renderBoard({ status: "lost" });
      expect(startGame).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole("button", { name: "Play again" }));

      expect(startGame).toHaveBeenCalledTimes(2);
    });
  });
});
