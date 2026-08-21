import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import { CodexSessionRepository } from "../src/codexSessionRepository";

test("scans sessions, groups by project, and reads conversation content", async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "codexchat-test-"));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));

  const sessionId = "11111111-2222-4333-8444-555555555555";
  const projectPath = path.join(temporary, "demo-project");
  const sessionDirectory = path.join(temporary, "sessions", "2026", "08", "19");
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(sessionDirectory, { recursive: true });
  await fs.writeFile(
    path.join(temporary, "session_index.jsonl"),
    JSON.stringify({ id: sessionId, thread_name: "测试会话", updated_at: "2026-08-19T10:10:00.000Z" }) + "\n",
    "utf8",
  );

  const records = [
    {
      timestamp: "2026-08-19T10:00:00.000Z",
      type: "session_meta",
      payload: {
        session_id: sessionId,
        id: sessionId,
        timestamp: "2026-08-19T10:00:00.000Z",
        cwd: projectPath,
        cli_version: "1.0.0",
      },
    },
    {
      timestamp: "2026-08-19T10:01:00.000Z",
      type: "response_item",
      payload: { type: "message", role: "user", content: [{ type: "input_text", text: "检查项目" }] },
    },
    {
      timestamp: "2026-08-19T10:02:01.000Z",
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {
          total_token_usage: {
            input_tokens: 100,
            cached_input_tokens: 40,
            cache_write_input_tokens: 5,
            output_tokens: 20,
            reasoning_output_tokens: 8,
            total_tokens: 120,
          },
          last_token_usage: { total_tokens: 120 },
        },
      },
    },
    {
      timestamp: "2026-08-19T10:03:00.000Z",
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {
          total_token_usage: {
            input_tokens: 220,
            cached_input_tokens: 90,
            cache_write_input_tokens: 10,
            output_tokens: 45,
            reasoning_output_tokens: 15,
            total_tokens: 265,
          },
          last_token_usage: { total_tokens: 145 },
        },
      },
    },
    {
      timestamp: "2026-08-19T10:02:00.000Z",
      type: "response_item",
      payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "已经完成检查。" }] },
    },
  ];
  const sessionFile = path.join(sessionDirectory, `rollout-${sessionId}.jsonl`);
  await fs.writeFile(sessionFile, records.map(record => JSON.stringify(record)).join("\n") + "\n{", "utf8");

  const repository = new CodexSessionRepository(temporary, "en");
  const index = await repository.scan({ includeArchived: true });

  assert.equal(index.projects.length, 1);
  assert.equal(index.conversations.length, 1);
  assert.equal(index.conversations[0].title, "测试会话");
  assert.equal(index.projects[0].path, projectPath);
  assert.deepEqual(index.conversations[0].tokenUsage, {
    inputTokens: 220,
    cachedInputTokens: 90,
    cacheWriteInputTokens: 10,
    outputTokens: 45,
    reasoningOutputTokens: 15,
    totalTokens: 265,
  });

  const detail = await repository.readConversation(index.conversations[0]);
  assert.equal(detail.entries.length, 2);
  assert.equal(detail.entries[0].kind, "user");
  assert.equal(detail.entries[1].kind, "assistant");
  assert.equal(detail.malformedLineCount, 1);
});

test("excludes conversations whose project path no longer exists", async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "codexchat-missing-project-test-"));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));

  const activeSessionId = "21111111-2222-4333-8444-555555555555";
  const missingSessionId = "31111111-2222-4333-8444-555555555555";
  const activeProjectPath = path.join(temporary, "active-project");
  const missingProjectPath = path.join(temporary, "deleted-project");
  const sessionDirectory = path.join(temporary, "sessions", "2026", "08", "20");
  await fs.mkdir(activeProjectPath, { recursive: true });
  await fs.mkdir(sessionDirectory, { recursive: true });

  const writeSession = async (sessionId: string, cwd: string, totalTokens: number) => {
    const records = [
      {
        timestamp: "2026-08-20T10:00:00.000Z",
        type: "session_meta",
        payload: {
          session_id: sessionId,
          id: sessionId,
          timestamp: "2026-08-20T10:00:00.000Z",
          cwd,
        },
      },
      {
        timestamp: "2026-08-20T10:01:00.000Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: {
              input_tokens: totalTokens,
              output_tokens: 0,
              reasoning_output_tokens: 0,
              total_tokens: totalTokens,
            },
          },
        },
      },
    ];
    await fs.writeFile(
      path.join(sessionDirectory, `rollout-${sessionId}.jsonl`),
      records.map(record => JSON.stringify(record)).join("\n") + "\n",
      "utf8",
    );
  };

  await writeSession(activeSessionId, activeProjectPath, 100);
  await writeSession(missingSessionId, missingProjectPath, 900);

  const repository = new CodexSessionRepository(temporary, "en");
  const index = await repository.scan({ includeArchived: true });

  assert.equal(index.projects.length, 1);
  assert.equal(index.projects[0].path, activeProjectPath);
  assert.equal(index.projects[0].pathExists, true);
  assert.deepEqual(index.conversations.map(conversation => conversation.id), [activeSessionId]);
  assert.equal(index.conversations[0].tokenUsage?.totalTokens, 100);
});

test("keeps manually selected projects that have no conversations", async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "codexchat-empty-test-"));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const projectPath = path.join(temporary, "empty-project");
  await fs.mkdir(projectPath, { recursive: true });

  const repository = new CodexSessionRepository(temporary, "en");
  const index = await repository.scan({
    includeArchived: true,
    customProjects: [{ path: projectPath, addedAt: "2026-08-19T10:00:00.000Z" }],
  });

  assert.equal(index.projects.length, 1);
  assert.equal(index.projects[0].custom, true);
  assert.equal(index.projects[0].conversations.length, 0);
});
