(() => {
  const form = document.querySelector("#login-form");
  const usernameInput = document.querySelector("#username");
  const passwordInput = document.querySelector("#password");
  const feedback = document.querySelector("#login-feedback");

  async function loadAccounts(path, collection) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Không thể tải ${path} (HTTP ${response.status}).`);
    const data = await response.json();
    if (!Array.isArray(data[collection])) throw new Error(`Dữ liệu ${path} không đúng cấu trúc.`);
    return data[collection];
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    feedback.classList.remove("is-success");
    feedback.textContent = "";
    if (!form.reportValidity()) return;

    try {
      const [customers, employees] = await Promise.all([
        loadAccounts("customers.json", "customers"),
        loadAccounts("employees.json", "employees")
      ]);
      const identity = usernameInput.value.trim().toLocaleLowerCase("vi");
      const password = passwordInput.value;
      const account = [...customers, ...employees].find((item) =>
        (item.username.toLocaleLowerCase("vi") === identity || item.email.toLocaleLowerCase("vi") === identity)
        && item.password === password
        && item.status === "active"
      );

      if (!account) {
        feedback.textContent = "Thông tin đăng nhập không đúng hoặc tài khoản đã bị khóa.";
        passwordInput.setCustomValidity("Kiểm tra lại tên đăng nhập và mật khẩu.");
        passwordInput.reportValidity();
        passwordInput.setCustomValidity("");
        return;
      }

      const currentUser = {
        id: account.id,
        fullName: account.fullName,
        username: account.username,
        email: account.email,
        phone: account.phone,
        role: account.role,
        address: account.address || null
      };
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
      feedback.classList.add("is-success");
      feedback.textContent = `Đăng nhập thành công. Xin chào ${account.fullName}!`;
      const checkoutPending = localStorage.getItem("checkoutAfterLogin") === "true";
      localStorage.removeItem("checkoutAfterLogin");
      const nextPage = account.role !== "customer"
        ? "dashboard.html"
        : checkoutPending
          ? "index.html?checkout=1"
          : "index.html";
      window.setTimeout(() => { window.location.href = nextPage; }, 500);
    } catch (error) {
      console.error("Không thể xác thực tài khoản demo.", error);
      feedback.textContent = "Chưa thể tải dữ liệu đăng nhập. Hãy chạy website qua máy chủ web và thử lại.";
    }
  });
})();
