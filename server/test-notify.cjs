const http = require("http");

const loginData = JSON.stringify({
  email: "amanmanhar2003@gmail.com",
  password: "Aman@1234"
});

const req = http.request(
  "http://localhost:8000/auth/login",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(loginData)
    }
  },
  (res) => {
    let body = "";
    res.on("data", (c) => (body += c));
    res.on("end", () => {
      const data = JSON.parse(body);
      const token = data.token;
      const userId = data.user._id;

      // Now create a task assigned to ourselves
      const taskData = JSON.stringify({
        title: "Test Task for Notification",
        description: "Checking if native banner shows up",
        projectId: null, // Depending on if it's required. Let's get a project ID first.
        // Actually, let's just use the api to update our own status or something?
        // Wait, creating a project doesn't send a notification.
        // What sends a notification?
        // 1. Task assigned
        // 2. Task status changed
        // 3. Delete notification? No.
      });

      console.log("User ID:", userId);
    });
  }
);

req.write(loginData);
req.end();
