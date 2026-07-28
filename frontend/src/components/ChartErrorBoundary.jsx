import { Component } from "react";
import i18n from "../i18n";

/**
 * Catches render errors from a chart subtree so one failing chart shows a
 * fallback message instead of blanking the whole page. Especially important
 * in the packaged desktop app, which has no dev error overlay.
 */
class ChartErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Chart failed to render:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {i18n.t("charts.chartError")}
        </p>
      );
    }
    return this.props.children;
  }
}

export default ChartErrorBoundary;
