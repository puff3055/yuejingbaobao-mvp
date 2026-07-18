import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("./App.jsx", import.meta.url), "utf8");
const styleSource = await readFile(new URL("./styles.css", import.meta.url), "utf8");

test("keeps ovarian, endometrial and cervical-mucus explanations visible", () => {
  const requiredLabels = [
    "多枚卵泡开始发育",
    "优势卵泡继续生长",
    "排卵事件\\n时点会变化",
    "黄体形成并发挥作用",
    "未妊娠时黄体逐渐退化",
    "功能层脱落与出血",
    "脱落尚在发生\\n表面已开始修复",
    "雌二醇相关的增殖与增厚",
    "孕酮相关的分泌性改变",
    "接近排卵时可更清、更滑、更易拉丝",
  ];
  requiredLabels.forEach((label) => assert.ok(appSource.includes(label), `missing cycle label: ${label}`));
});

test("maps every direct physiology track to authoritative sources and boundaries", () => {
  ["NBK279054", "37666081", "PMC6710244", "PMC9098793", "PMC9580638", "PMC7663572"].forEach((locator) => {
    assert.ok(appSource.includes(locator), `missing authoritative locator: ${locator}`);
  });
  assert.ok(appSource.includes("不是你的实时 X 光、排卵确认、内膜测量或激素检测"));
  assert.ok(appSource.includes("成品妇产科专家签字仍待完成"));
  assert.equal(appSource.includes("D17–18"), false, "fixed ovulation-day claim must not return");
});

test("uses one aligned mobile axis and preserves illustration aspect ratios", () => {
  assert.ok(styleSource.includes(".cycle-axis { position: relative"));
  assert.ok(styleSource.includes(".day-ruler span:first-child { transform: none; }"));
  assert.ok(styleSource.includes(".day-ruler span:last-child { transform: translateX(-100%); }"));
  assert.match(styleSource, /\.system-track > img \{[^}]*height: auto;/s);
  assert.equal(styleSource.includes(".system-track img { width: 100%; height: 62px"), false);
});
