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
      "Content-Length": loginData.length
    }
  },
  (res) => {
    let cookie = res.headers["set-cookie"];
    
    let body = "";
    res.on("data", (c) => (body += c));
    res.on("end", () => {
      const data = JSON.parse(body);
      const token = data.token;
      
      const projectData = JSON.stringify({
        name: "Test Project",
        description: "Test",
        teamMembers: [],
        priority: "Normal",
        dueDate: new Date().toISOString()
      });
      
      const req2 = http.request(
        "http://localhost:8000/projects/create",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": projectData.length,
            "Authorization": `Bearer ${token}`
          }
        },
        (res2) => {
          let b2 = "";
          res2.on("data", (c) => (b2 += c));
          res2.on("end", () => {
            console.log("Status:", res2.statusCode);
            console.log("Response:", b2);
          });
        }
      );
      req2.write(projectData);
      req2.end();
    });
  }
);

req.write(loginData);
req.end();
