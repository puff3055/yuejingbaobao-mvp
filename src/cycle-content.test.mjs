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
  assert.ok(appSource.includes("妳的日期记录不能测出排卵、内膜厚度或激素水平"));
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

test("keeps cycle position, editable rhythm records and replayable onboarding in the demo", () => {
  [
    "我的当前位置",
    "接下来可能发生什么",
    "记录今天的节律",
    "修改这次节律",
    "删除这条节律记录",
    "重看月之种子来到小窝的过程",
    "退出 Onboarding，不保存本次修改",
  ].forEach((label) => assert.ok(appSource.includes(label), `missing interactive flow: ${label}`));
  assert.ok(appSource.includes("growth: Math.max"), "replaying onboarding must not reset earned growth");
  assert.ok(styleSource.includes("rgba(247,241,255,.74)"), "current position should use the pearl/lilac moonlight beam");
  assert.equal(styleSource.includes("#eac77e"), false, "the harsh gold position rule must not return");
});

test("uses the owner-selected cycle language and a custom start/end-date editor", () => {
  assert.ok(appSource.includes("她周期全景图"));
  assert.ok(appSource.includes("同一个时间点，看见我的身体正在如何协同"));
  assert.ok(appSource.includes("我现在在生理周期的哪个位置"));
  assert.ok(appSource.includes("由妳确认，不替妳猜"));
  assert.ok(appSource.includes("这次月经从哪天结束"));
  assert.ok(appSource.includes("还没有结束"));
  assert.ok(appSource.includes("function CycleCalendar"));
  assert.equal(appSource.includes("确认我的位置"), false);
  assert.equal(appSource.includes("典型教学坐标"), false);
});

test("keeps body and rhythm recording together in the cycle screen", () => {
  assert.ok(appSource.includes("记录今天的节律"));
  assert.ok(appSource.includes("点点身体位置"));
  assert.ok(appSource.includes("onBodyRecord={openBodyMap}"));
  assert.equal(appSource.includes("不想打字，点点身体"), false);
});

test("shows research context and personal rhythm together instead of hiding either behind tabs", () => {
  assert.ok(appSource.includes("这个位置，研究能告诉我什么"));
  assert.ok(appSource.includes("我的记录正在形成怎样的线索"));
  assert.equal(appSource.includes('activeView === "research"'), false);
  assert.equal(appSource.includes('activeView === "personal"'), false);
});
