async function run() {
  try {
    const loginRes = await fetch("http://localhost:8000/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "amanmanhar2003@gmail.com",
        password: "Aman@1234"
      })
    });
    
    const loginData = await loginRes.json();
    const token = loginData.token;
    
    let cookie = "";
    const setCookie = loginRes.headers.get('set-cookie');
    if (setCookie) {
      cookie = setCookie.split(';')[0];
    }

    const headers = {
      "Content-Type": "application/json"
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (cookie) headers["Cookie"] = cookie;

    const endpoints = [
      "/attendance/my",
      "/attendance/all",
      "/attendance/analytics",
      "/attendance/correction-requests",
      "/users/all",
      "/attendance/frozen-accounts"
    ];

    for (const ep of endpoints) {
      try {
        console.log(`Testing ${ep}...`);
        const res = await fetch(`http://localhost:8000${ep}`, { headers });
        const text = await res.text();
        if (res.ok) {
           console.log(`${ep} OK`);
        } else {
           console.error(`${ep} FAILED: ${res.status} - ${text}`);
        }
      } catch (err) {
        console.error(`${ep} FETCH ERROR: ${err.message}`);
      }
    }
  } catch (err) {
    console.error("Login failed:", err.message);
  }
}

run();
