import { useEffect } from "react";
import { getCore } from "../app/core";
import { useStore } from "../app/store";
import { partFn, partName, systemName, t } from "../app/i18n";
import { traceChainFor } from "../machine/keyboardLayout";
import { getBuild } from "../scene/buildRegistry";

export function PartInfo() {
  const selectedPart = useStore((s) => s.selectedPart);
  const explodeCurrent = useStore((s) => s.explodeCurrent);
  const selectPart = useStore((s) => s.selectPart);
  const startTrace = useStore((s) => s.startTrace);
  const stopTrace = useStore((s) => s.stopTrace);
  const setSlowMotion = useStore((s) => s.setSlowMotion);
  const showPlaqueKey = useStore((s) => s.showPlaqueKey);
  const build = getBuild();
  const part = selectedPart ? build?.byId.get(selectedPart) : undefined;

  // In exploded view, selecting a key highlights its entire strike chain.
  useEffect(() => {
    if (!selectedPart || explodeCurrent < 0.5) return;
    if (!selectedPart.startsWith("key.")) return;
    const chain = traceChainFor(selectedPart.replace(/^key\./u, ""));
    if (chain.length > 0) startTrace(chain);
  }, [selectedPart, explodeCurrent, startTrace]);

  if (!part || !selectedPart) return null;

  const followKeystroke = () => {
    const core = getCore();
    if (core.machine.explode > 0.08) {
      showPlaqueKey("plaque.assemble");
      return;
    }
    const code = selectedPart.startsWith("key.") ? selectedPart.slice(4) : "KeyA";
    const chain = traceChainFor(code);
    setSlowMotion(true);
    if (chain.length) startTrace(chain);
    core.machine.press(code);
    window.setTimeout(() => {
      setSlowMotion(false);
      stopTrace();
    }, 2600);
  };

  const names = (ids: string[]) =>
    ids
      .map((id) => {
        const related = build?.byId.get(id);
        return related ? partName(related.label) : id;
      })
      .filter(Boolean)
      .join(" · ");

  return (
    <aside className="part-info" aria-label={t("part.info")}>
      <div className="part-info-head">
        <span className="part-info-system">{systemName(part.system)}</span>
        <button className="hud-btn small" onClick={() => selectPart(null)} aria-label="Close part information">
          ×
        </button>
      </div>
      <h3 className="part-info-label">{partName(part.label)}</h3>
      <p className="part-info-fn">{partFn(part.fn)}</p>
      {part.upstream.length > 0 && (
        <p className="part-info-rel">
          <span>{t("part.from")}</span> {names(part.upstream)}
        </p>
      )}
      {part.downstream.length > 0 && (
        <p className="part-info-rel">
          <span>{t("part.drives")}</span> {names(part.downstream)}
        </p>
      )}
      <button className="hud-btn accent" onClick={followKeystroke} aria-label="Follow the keystroke in slow motion">
        {t("part.follow")}
      </button>
    </aside>
  );
}
