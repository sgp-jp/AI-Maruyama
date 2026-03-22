import { BulletListEditor } from "./BulletListEditor";

export function ThreePlanTable({
  minimum,
  standard,
  ideal,
  onChangeMinimum,
  onChangeStandard,
  onChangeIdeal
}: {
  minimum: string[];
  standard: string[];
  ideal: string[];
  onChangeMinimum?: (items: string[]) => void;
  onChangeStandard?: (items: string[]) => void;
  onChangeIdeal?: (items: string[]) => void;
}) {
  return (
    <div className="grid two" style={{ alignItems: "start" }}>
      <div className="card" style={{ padding: 12 }}>
        <h4 style={{ marginTop: 0 }}>最低限</h4>
        <BulletListEditor items={minimum} editable={Boolean(onChangeMinimum)} onChange={onChangeMinimum} />
      </div>
      <div className="card" style={{ padding: 12 }}>
        <h4 style={{ marginTop: 0 }}>標準</h4>
        <BulletListEditor items={standard} editable={Boolean(onChangeStandard)} onChange={onChangeStandard} />
      </div>
      <div className="card" style={{ padding: 12 }}>
        <h4 style={{ marginTop: 0 }}>理想</h4>
        <BulletListEditor items={ideal} editable={Boolean(onChangeIdeal)} onChange={onChangeIdeal} />
      </div>
    </div>
  );
}
