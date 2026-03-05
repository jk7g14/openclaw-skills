#!/usr/bin/env node
// Grok Prompt Runner - agent-browser로 Grok에 프롬프트 전송 후 결과 수집

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ENV = { ...process.env, AGENT_BROWSER_AUTO_CONNECT: "1" };

function ab(cmd) {
  try {
    return execSync(`agent-browser ${cmd}`, { env: ENV, encoding: "utf-8", timeout: 30000 }).trim();
  } catch (e) {
    return e.stdout?.trim() || "";
  }
}

function abEval(js) {
  // Write JS to temp file to avoid shell escaping issues
  const tmp = path.join("/tmp", `ab_eval_${process.pid}.js`);
  fs.writeFileSync(tmp, js, "utf-8");
  try {
    return execSync(`agent-browser eval "$(cat '${tmp}')"`, { env: ENV, encoding: "utf-8", timeout: 30000 }).trim();
  } catch (e) {
    return e.stdout?.trim() || "";
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

function sleep(ms) {
  execSync(`sleep ${ms / 1000}`);
}

function main() {
  const promptFile = process.argv[2] || path.join(__dirname, "prompts", "ai-trend.txt");
  if (!fs.existsSync(promptFile)) {
    console.error(`❌ Prompt file not found: ${promptFile}`);
    process.exit(1);
  }

  const today = new Date().toISOString().split("T")[0];
  let prompt = fs.readFileSync(promptFile, "utf-8").replace(/\[오늘 날짜\]/g, today);

  const outputDir = path.join(__dirname, "outputs");
  fs.mkdirSync(outputDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15);
  const basename = path.basename(promptFile, ".txt");
  const outputFile = path.join(outputDir, `${ts}_${basename}.md`);

  console.log("🚀 Grok Prompt Runner");
  console.log(`📄 Prompt: ${promptFile}`);
  console.log(`📅 Date: ${today}\n`);

  // 1. Open Grok
  console.log("🌐 Opening grok.com...");
  ab('open "https://grok.com"');
  sleep(3000);
  ab("wait --load networkidle");
  sleep(2000);

  // 2. Focus input
  console.log("✏️  Focusing input...");
  abEval(`document.querySelector('[contenteditable=true]').focus()`);
  sleep(1000);

  // 3. Insert prompt - write as JSON string literal to avoid encoding issues
  console.log("📝 Inserting prompt...");
  const jsStr = JSON.stringify(prompt);
  abEval(`
    const el = document.querySelector('[contenteditable=true]');
    el.focus();
    el.innerText = ${jsStr};
    el.dispatchEvent(new Event('input', { bubbles: true }));
  `);
  sleep(2000);

  const inserted = abEval(`document.querySelector('[contenteditable=true]').innerText.length`);
  console.log(`📊 Inserted: ${inserted} chars`);

  if (!inserted || inserted === "0" || inserted === "null") {
    console.error("❌ Failed to insert prompt");
    process.exit(1);
  }

  // 4. Submit
  console.log("🚀 Submitting...");
  ab("press Enter");
  sleep(3000);

  const url = ab("get url");
  console.log(`📍 URL: ${url}`);
  console.log("⏳ Waiting for Grok response (1-3 min)...");

  // 5. Poll for completion
  sleep(15000);
  let prevLen = 0;
  let stableCount = 0;

  for (let i = 0; i < 90; i++) {
    const snap = ab("snapshot");
    const currLen = snap.length;

    if (currLen === prevLen && currLen > 1000) {
      stableCount++;
    } else {
      stableCount = 0;
    }

    if (stableCount >= 5) {
      console.log("\n✅ Response complete!");
      break;
    }

    prevLen = currLen;
    process.stdout.write(`\r⏳ ${i * 2 + 15}s | content: ${currLen} chars | stable: ${stableCount}/5`);
    sleep(2000);
  }
  console.log("");

  // 6. Extract response
  console.log("📥 Extracting response...");
  let response = abEval(`
    const msgs = document.querySelectorAll('[message-bubble]');
    if (msgs.length >= 2) {
      msgs[msgs.length - 1].innerText;
    } else {
      const md = document.querySelectorAll('.response-content-markdown');
      if (md.length > 0) {
        md[md.length - 1].innerText;
      } else {
        const main = document.querySelector('main');
        main ? main.innerText : 'EXTRACTION_FAILED';
      }
    }
  `);

  if (!response || response === "EXTRACTION_FAILED") {
    console.log("⚠️  JS extraction failed, using snapshot...");
    response = ab("snapshot");
  }

  // Remove wrapping quotes
  if (response.startsWith('"') && response.endsWith('"')) {
    try { response = JSON.parse(response); } catch {}
  }

  fs.writeFileSync(outputFile, response, "utf-8");

  console.log(`\n💾 Saved: ${outputFile}\n`);
  console.log("=========================================");
  console.log("         GROK RESPONSE");
  console.log("=========================================\n");
  console.log(response);
}

main();
