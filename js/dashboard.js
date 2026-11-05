(() => {
  const page = document.querySelector(".dashboard-page");
  const notice = document.querySelector("#dashboard-notice");
  const ordersBody = document.querySelector("#dashboard-orders");
  const topProducts = document.querySelector("#top-products");
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const dateFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" });
  const statusLabels = {
    completed: "Hoàn thành",
    shipped: "Đang giao",
    processing: "Đang xử lý",
    pending: "Chờ xử lý",
    cancelled: "Đã hủy",
    refunded: "Đã hoàn tiền"
  };
  let orders = [];
  let products = new Map();
  let customers = new Map();
  let employees = new Map();

  function showNotice(message, isError = false) {
    notice.hidden = !message;
    notice.textContent = message;
    notice.classList.toggle("is-error", isError);
  }

  function hasValidStaffSession() {
    let user;
    try {
      user = JSON.parse(localStorage.getItem("currentUser") || "null");
    } catch (error) {
      console.error("Không thể đọc phiên đăng nhập.", error);
    }

    if (!user) {
      window.location.replace("login.html");
      return false;
    }
    if (user.role === "customer") {
      page.replaceChildren();
      const denied = document.createElement("section");
      denied.className = "dashboard-access-denied";
      const title = document.createElement("h1");
      title.textContent = "Khu vực dành cho nhân viên";
      const message = document.createElement("p");
      message.textContent = "Tài khoản khách hàng không có quyền xem thống kê đơn hàng.";
      const link = document.createElement("a");
      link.className = "button button-primary";
      link.href = "index.html";
      link.textContent = "Về trang chủ";
      denied.append(title, message, link);
      page.append(denied);
      return false;
    }
    if (!String(user.id || "").startsWith("EMP-")) {
      showNotice("Không xác định được tài khoản nhân viên. Vui lòng đăng nhập lại.", true);
      return false;
    }
    document.querySelector("#staff-welcome").textContent = `Xin chào, ${user.fullName}`;
    const accountLink = document.querySelector("#dashboard-account-link");
    accountLink.textContent = `Đăng xuất (${user.fullName})`;
    accountLink.href = "#logout";
    accountLink.addEventListener("click", (event) => {
      event.preventDefault();
      localStorage.removeItem("currentUser");
      window.location.href = "login.html";
    });
    return true;
  }

  function childText(parent, selector) {
    return parent.querySelector(selector)?.textContent?.trim() || "";
  }

  function parseSampleInvoices(xmlText) {
    const xml = new DOMParser().parseFromString(xmlText, "application/xml");
    if (xml.querySelector("parsererror")) throw new Error("carts.xml không đúng định dạng XML.");
    return [...xml.querySelectorAll("invoices > invoice")].map((invoice) => {
      const items = [...invoice.querySelectorAll(":scope > items > item")].map((item) => ({
        productId: Number(item.getAttribute("productId")),
        name: childText(item, "productName"),
        quantity: Number(childText(item, "quantity")) || 0,
        lineTotal: Number(childText(item, "lineTotal")) || 0
      }));
      return {
        id: invoice.getAttribute("id") || "Invoice",
        createdAt: invoice.getAttribute("createdAt") || "",
        status: invoice.getAttribute("status") || "pending",
        customerId: invoice.getAttribute("customerId") || "",
        employeeId: invoice.getAttribute("employeeId") || "",
        total: Number(childText(invoice, "totals > grandTotal")) || 0,
        paymentStatus: invoice.querySelector(":scope > payment")?.getAttribute("status") || "pending",
        items,
        source: "sample"
      };
    });
  }

  function parseLocalOrders() {
    try {
      const stored = JSON.parse(localStorage.getItem("completedOrders") || "[]");
      if (!Array.isArray(stored)) throw new Error("completedOrders phải là một danh sách.");
      return stored.map((order) => ({
        id: String(order.id || "Local order"),
        createdAt: String(order.createdAt || ""),
        status: String(order.status || "completed"),
        customerId: String(order.customerId || ""),
        employeeId: "",
        total: Number(order.total) || 0,
        paymentStatus: String(order.payment?.status || "paid"),
        items: Array.isArray(order.items) ? order.items.map((item) => ({
          productId: Number(item.productId),
          name: String(item.title || ""),
          quantity: Number(item.quantity) || 0,
          lineTotal: Number(item.lineTotal) || Number(item.unitPrice) * Number(item.quantity) || 0
        })) : [],
        source: "local"
      }));
    } catch (error) {
      console.error("Không thể đọc đơn hàng đã thanh toán trên trình duyệt.", error);
      showNotice("Không đọc được completedOrders trong localStorage; vẫn hiển thị hóa đơn mẫu.", true);
      return [];
    }
  }

  async function getJson(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`${path} trả về HTTP ${response.status}`);
    return response.json();
  }

  async function loadDashboardData() {
    const [invoiceResponse, productResponse, customerData, employeeData] = await Promise.all([
      fetch("carts.xml"),
      fetch("products.xml"),
      getJson("customers.json"),
      getJson("employees.json")
    ]);
    if (!invoiceResponse.ok) throw new Error(`carts.xml trả về HTTP ${invoiceResponse.status}`);
    if (!productResponse.ok) throw new Error(`products.xml trả về HTTP ${productResponse.status}`);
    if (!Array.isArray(customerData.customers) || !Array.isArray(employeeData.employees)) {
      throw new Error("Tệp khách hàng hoặc nhân viên không đúng cấu trúc.");
    }
    const [invoicesText, productsText] = await Promise.all([invoiceResponse.text(), productResponse.text()]);
    const productsXml = new DOMParser().parseFromString(productsText, "application/xml");
    if (productsXml.querySelector("parsererror")) throw new Error("products.xml không đúng định dạng XML.");
    products = new Map([...productsXml.querySelectorAll("products > product")].map((product) => [
      Number(product.getAttribute("id")),
      {
        id: Number(product.getAttribute("id")),
        name: childText(product, "title"),
        price: Number(childText(product, "price")) || 0
      }
    ]));
    customers = new Map(customerData.customers.map((customer) => [customer.id, customer.fullName]));
    employees = new Map(employeeData.employees.map((employee) => [employee.id, employee.fullName]));
    orders = [...parseSampleInvoices(invoicesText), ...parseLocalOrders()];
    orders.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    showNotice("");
    renderDashboard();
  }

  function isRevenueOrder(order) {
    return order.paymentStatus === "paid" && order.status !== "cancelled" && order.status !== "refunded";
  }

  function getFilteredOrders() {
    const status = document.querySelector("#status-filter").value;
    const from = document.querySelector("#date-from").value;
    const to = document.querySelector("#date-to").value;
    return orders.filter((order) => {
      const date = order.createdAt.slice(0, 10);
      return (!status || order.status === status) && (!from || date >= from) && (!to || date <= to);
    });
  }

  function renderMetrics(filteredOrders) {
    const paidOrders = filteredOrders.filter(isRevenueOrder);
    const revenue = paidOrders.reduce((sum, order) => sum + order.total, 0);
    const units = paidOrders.reduce((sum, order) =>
      sum + order.items.reduce((lineSum, item) => lineSum + item.quantity, 0), 0);
    document.querySelector("#metric-orders").textContent = String(filteredOrders.length);
    document.querySelector("#metric-paid-orders").textContent = String(paidOrders.length);
    document.querySelector("#metric-revenue").textContent = money.format(revenue);
    document.querySelector("#metric-units").textContent = String(units);
    document.querySelector("#metric-order-caption").textContent = `Trong ${orders.length} hóa đơn tổng cộng`;
    document.querySelector("#dashboard-period").textContent = filteredOrders.length === orders.length
      ? "Tất cả thời gian"
      : `Đang lọc ${filteredOrders.length} / ${orders.length} đơn`;
    document.querySelector("#orders-summary").textContent =
      "Nguồn: 200 hóa đơn mẫu trong carts.xml và các đơn thanh toán demo trên trình duyệt.";
  }

  function renderTopProducts(filteredOrders) {
    const quantities = new Map();
    for (const order of filteredOrders.filter(isRevenueOrder)) {
      for (const item of order.items) {
        const key = String(item.productId);
        const entry = quantities.get(key) || { quantity: 0, revenue: 0, name: "" };
        const product = products.get(Number(key));
        entry.quantity += item.quantity;
        entry.revenue += item.lineTotal;
        entry.name = product?.name || item.name || `Sản phẩm #${key}`;
        quantities.set(key, entry);
      }
    }
    const ranked = [...quantities.entries()]
      .sort((a, b) => b[1].quantity - a[1].quantity || b[1].revenue - a[1].revenue)
      .slice(0, 6);
    topProducts.replaceChildren();
    if (!ranked.length) {
      const empty = document.createElement("p");
      empty.className = "dashboard-empty";
      empty.textContent = "Chưa có sản phẩm bán trong bộ lọc hiện tại.";
      topProducts.append(empty);
      return;
    }
    const maximum = ranked[0][1].quantity;
    ranked.forEach(([id, entry], index) => {
      const card = document.createElement("article");
      card.className = "top-product";
      const header = document.createElement("div");
      header.className = "top-product-header";
      const rank = document.createElement("span");
      rank.className = "top-product-rank";
      rank.textContent = String(index + 1);
      const name = document.createElement("h3");
      name.className = "top-product-name";
      name.textContent = entry.name;
      const quantity = document.createElement("span");
      quantity.className = "top-product-units";
      quantity.textContent = `${entry.quantity} đã bán`;
      header.append(rank, name, quantity);
      const track = document.createElement("div");
      track.className = "top-product-track";
      track.setAttribute("role", "img");
      track.setAttribute("aria-label", `${entry.name}: ${entry.quantity} sản phẩm đã bán`);
      const bar = document.createElement("div");
      bar.className = "top-product-bar";
      bar.style.width = `${Math.max(8, entry.quantity / maximum * 100)}%`;
      track.append(bar);
      const revenue = document.createElement("p");
      revenue.className = "top-product-revenue";
      revenue.textContent = `Doanh thu sản phẩm: ${money.format(entry.revenue)} · ID ${id}`;
      card.append(header, track, revenue);
      topProducts.append(card);
    });
  }

  function createCell(row, text) {
    const cell = document.createElement("td");
    cell.textContent = text;
    row.append(cell);
    return cell;
  }

  function renderOrderTable(filteredOrders) {
    const fragment = document.createDocumentFragment();
    if (!filteredOrders.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.className = "dashboard-empty";
      cell.colSpan = 7;
      cell.textContent = "Không có đơn hàng phù hợp với bộ lọc.";
      row.append(cell);
      fragment.append(row);
    } else {
      for (const order of filteredOrders) {
        const row = document.createElement("tr");
        createCell(row, order.id);
        const date = Date.parse(order.createdAt);
        createCell(row, Number.isNaN(date) ? "—" : dateFormatter.format(date));
        createCell(row, customers.get(order.customerId) || order.customer?.name || order.customerId || "Khách tại quầy");
        createCell(row, employees.get(order.employeeId) || "Website / dữ liệu demo");
        createCell(row, String(order.items.reduce((sum, item) => sum + item.quantity, 0)));
        createCell(row, money.format(order.total));
        const statusCell = createCell(row, "");
        const badge = document.createElement("span");
        badge.className = "status-badge";
        if (isRevenueOrder(order)) badge.classList.add("is-paid");
        else if (order.status === "pending" || order.status === "processing") badge.classList.add("is-pending");
        else if (order.status === "cancelled" || order.status === "refunded") badge.classList.add("is-cancelled");
        badge.textContent = `${statusLabels[order.status] || order.status} · ${order.paymentStatus}`;
        statusCell.append(badge);
        fragment.append(row);
      }
    }
    ordersBody.replaceChildren(fragment);
    document.querySelector("#dashboard-order-count").textContent = `Hiển thị ${filteredOrders.length} đơn hàng`;
  }

  function renderDashboard() {
    const filteredOrders = getFilteredOrders();
    renderMetrics(filteredOrders);
    renderTopProducts(filteredOrders);
    renderOrderTable(filteredOrders);
  }

  if (!hasValidStaffSession()) return;

  const filters = document.querySelector("#dashboard-filters");
  filters.addEventListener("submit", (event) => {
    event.preventDefault();
    const from = document.querySelector("#date-from");
    const to = document.querySelector("#date-to");
    to.setCustomValidity(from.value && to.value && to.value < from.value ? "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu." : "");
    if (!filters.reportValidity()) return;
    renderDashboard();
  });
  filters.addEventListener("reset", () => window.setTimeout(renderDashboard));
  window.addEventListener("storage", (event) => {
    if (event.key === "completedOrders") {
      try {
        orders = [...orders.filter((order) => order.source !== "local"), ...parseLocalOrders()]
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        renderDashboard();
      } catch (error) {
        console.error("Không thể cập nhật dashboard khi đơn hàng thay đổi.", error);
      }
    }
  });

  loadDashboardData().catch((error) => {
    console.error("Không thể tải dữ liệu dashboard.", error);
    showNotice("Không thể tải dữ liệu thống kê. Hãy chạy website qua máy chủ web và kiểm tra carts.xml, products.xml, customers.json, employees.json.", true);
  });
})();
