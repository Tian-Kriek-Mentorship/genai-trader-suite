// /api/ig-login.js

export default async function handler(req, res) {
  const { IG_USERNAME, IG_PASSWORD, IG_API_KEY } = process.env;

  if (!IG_USERNAME || !IG_PASSWORD || !IG_API_KEY) {
    return res.status(500).json({ error: "Missing IG credentials in env" });
  }

  try {
    const loginRes = await fetch("https://demo-api.ig.com/gateway/deal/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json; charset=UTF-8",
        "X-IG-API-KEY": IG_API_KEY,
        "Version": "3"
      },
      body: JSON.stringify({
        identifier: IG_USERNAME,
        password: IG_PASSWORD
      })
    });

    const cst = loginRes.headers.get("CST");
    const xSecurityToken = loginRes.headers.get("X-SECURITY-TOKEN");

    const data = await loginRes.json();

    if (!cst || !xSecurityToken || !data.currentAccountId) {
      return res.status(401).json({ error: "Login failed", data });
    }

    return res.status(200).json({
      CST: cst,
      X_SECURITY_TOKEN: xSecurityToken,
      ACCOUNT_ID: data.currentAccountId
    });
  } catch (err) {
    return res.status(500).json({ error: "IG login error", details: err.message });
  }
}
