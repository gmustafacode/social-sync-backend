import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import jwt from "jsonwebtoken";
import authMiddleware from "../middleware/auth.js";

const backendRoot = path.resolve(import.meta.dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(backendRoot, relativePath), "utf8");

test("auth middleware rejects tokens without a user identity", async () => {
    process.env.JWT_SECRET = "isolation-test-secret";
    const request = { headers: { authorization: `Bearer ${jwt.sign({ role: "user" }, process.env.JWT_SECRET)}` } };
    let statusCode;
    let responseBody;
    let nextCalled = false;
    const response = {
        status(code) {
            statusCode = code;
            return this;
        },
        json(body) {
            responseBody = body;
            return this;
        }
    };

    await authMiddleware(request, response, () => { nextCalled = true; });

    assert.equal(statusCode, 401);
    assert.equal(responseBody.message, "Unauthenticated");
    assert.equal(nextCalled, false);
});

test("auth middleware attaches only the signed user identity", async () => {
    process.env.JWT_SECRET = "isolation-test-secret";
    const request = {
        headers: {
            authorization: `Bearer ${jwt.sign({ id: "user-a" }, process.env.JWT_SECRET)}`
        }
    };
    const response = { status: () => response, json: () => response };
    let nextCalled = false;

    await authMiddleware(request, response, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(request.userId, "user-a");
});

test("Express account and platform paths are owner-scoped", () => {
    const social = read("controllers/social.controller.js");
    const linkedin = read("controllers/linkedin/helpers.js");
    const facebook = read("controllers/facebook/helpers.js");
    const posting = read("services/posting.service.js");

    assert.match(social, /SocialAccount\.find\(\{ userId \}\)/);
    assert.match(social, /findOneAndDelete\(\{ _id: id, userId \}\)/);
    assert.match(linkedin, /SocialAccount\.findOne\(\{ platform: "linkedin", userId \}\)/);
    assert.match(facebook, /SocialAccount\.findOne\(\{ platform: "facebook", userId \}\)/);
    assert.match(posting, /SocialAccount\.findOne\(\{ _id: accountId, userId: post\.userId \}\)/);
    assert.doesNotMatch(linkedin, /temp-user-001/);
    assert.doesNotMatch(facebook, /temp-user-001/);
});

test("platform routes authenticate data endpoints", () => {
    for (const route of ["linkedin", "facebook", "instagram", "x"]) {
        const source = read(`routes/${route}.routes.js`);
        assert.match(source, /import authMiddleware/);
        assert.match(source, /router\.use\(authMiddleware\)/);
    }
});

test("Next content and mutation routes include owner filters", () => {
    const content = read("app/api/content/route.ts");
    const contentItem = read("app/api/content/[id]/route.ts");
    const posts = read("app/api/posts/[id]/route.ts");
    const accounts = read("app/api/accounts/[id]/route.ts");

    assert.doesNotMatch(content, /userId:\s*null/);
    assert.match(contentItem, /where: \{ id, userId \}/g);
    assert.match(posts, /where: \{ id, userId \}/g);
    assert.match(accounts, /where: \{ id, userId \}/g);
});
