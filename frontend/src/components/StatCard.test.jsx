import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { faWallet } from "@fortawesome/free-solid-svg-icons";
import StatCard from "./StatCard";

describe("StatCard", () => {
  it("renders label, value, and subtext", () => {
    render(
      <StatCard
        icon={faWallet}
        label="Balance"
        value="$1,000"
        subtext="as of today"
      />
    );
    expect(screen.getByText("Balance")).toBeInTheDocument();
    expect(screen.getByText("$1,000")).toBeInTheDocument();
    expect(screen.getByText("as of today")).toBeInTheDocument();
  });

  it("omits the subtext line when none is given", () => {
    render(<StatCard label="Net Worth" value="42" />);
    expect(screen.getByText("Net Worth")).toBeInTheDocument();
    expect(screen.queryByText("as of today")).not.toBeInTheDocument();
  });
});
