(() => {
  const tableBody = document.querySelector("#cart-table-body");
  const grandTotal = document.querySelector("#cart-grand-total");
  const checkoutButton = document.querySelector("#orders-checkout");
  const feedback = document.querySelector("#orders-feedback");
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  let products = [];
  let cartItems = [];

  function readCart() {
    try {
      const saved = JSON.parse(localStorage.getItem("shoppingCart") || '{"items":[]}');
      cartItems = Array.isArray(saved) ? saved : Array.isArray(saved.items) ? saved.items : [];
    } catch (error) {
      console.error("Không thể đọc giỏ hàng.", error);
      cartItems = [];
      feedback.textContent = "Không đọc được dữ liệu giỏ hàng đã lưu.";
    }
  }

  function saveCart() {
    localStorage.setItem("shoppingCart", JSON.stringify({
      items: cartItems,
      currency: "USD",
      updatedAt: new Date().toISOString()
    }));
  }

  function renderCart() {
    tableBody.replaceChildren();
    let total = 0;
    for (const item of cartItems) {
      const product = products.find((entry) => entry.id === Number(item.productId));
      const savedPrice = Number(item.price);
      const unitPrice = product?.price ?? (Number.isFinite(savedPrice) ? savedPrice : 0);
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const lineTotal = unitPrice * quantity;
      total += lineTotal;
      const row = document.createElement("tr");

      const titleCell = document.createElement("td");
      const title = document.createElement("span");
      title.className = "orders-product-name";
      title.textContent = product?.title || item.title || `Sản phẩm #${item.productId}`;
      const variant = document.createElement("span");
      variant.className = "orders-product-variant";
      variant.textContent = `Màu: ${item.variant || item.color || "Mặc định"}`;
      titleCell.append(title, variant);

      const priceCell = document.createElement("td");
      priceCell.textContent = money.format(unitPrice);
      const quantityCell = document.createElement("td");
      const quantityControls = document.createElement("div");
      quantityControls.className = "orders-quantity";
      const decrease = document.createElement("button");
      decrease.type = "button";
      decrease.dataset.cartAction = "decrease";
      decrease.dataset.id = String(item.productId);
      decrease.dataset.variant = item.variant || item.color || "";
      decrease.textContent = "−";
      decrease.setAttribute("aria-label", "Giảm số lượng");
      const quantityLabel = document.createElement("span");
      quantityLabel.textContent = String(quantity);
      const increase = document.createElement("button");
      increase.type = "button";
      increase.dataset.cartAction = "increase";
      increase.dataset.id = String(item.productId);
      increase.dataset.variant = item.variant || item.color || "";
      increase.textContent = "+";
      increase.setAttribute("aria-label", "Tăng số lượng");
      quantityControls.append(decrease, quantityLabel, increase);
      quantityCell.append(quantityControls);

      const lineCell = document.createElement("td");
      lineCell.textContent = money.format(lineTotal);
      const removeCell = document.createElement("td");
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "orders-remove";
      remove.dataset.cartAction = "remove";
      remove.dataset.id = String(item.productId);
      remove.dataset.variant = item.variant || item.color || "";
      remove.textContent = "Xóa";
      removeCell.append(remove);
      row.append(titleCell, priceCell, quantityCell, lineCell, removeCell);
      tableBody.append(row);
    }
    if (!cartItems.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.className = "orders-empty";
      cell.colSpan = 5;
      cell.textContent = "Giỏ hàng đang trống. Hãy chọn sản phẩm bạn yêu thích.";
      row.append(cell);
      tableBody.append(row);
    }
    grandTotal.textContent = money.format(total);
    checkoutButton.disabled = cartItems.length === 0;
  }

  tableBody.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("button[data-cart-action]");
    if (!button || !tableBody.contains(button)) return;
    const index = cartItems.findIndex((item) =>
      Number(item.productId) === Number(button.dataset.id)
      && (item.variant || item.color || "") === button.dataset.variant
    );
    if (index < 0) return;
    const action = button.dataset.cartAction;
    if (action === "remove") {
      cartItems.splice(index, 1);
    } else if (action === "increase") {
      const product = products.find((entry) => entry.id === Number(cartItems[index].productId));
      if (product && Number(cartItems[index].quantity) < product.stock) {
        cartItems[index].quantity = Number(cartItems[index].quantity) + 1;
      } else {
        feedback.textContent = "Số lượng đã đạt tồn kho hiện tại.";
        return;
      }
    } else if (action === "decrease") {
      cartItems[index].quantity = Number(cartItems[index].quantity) - 1;
      if (cartItems[index].quantity <= 0) cartItems.splice(index, 1);
    }
    try {
      saveCart();
      feedback.textContent = "";
      renderCart();
    } catch (error) {
      console.error("Không thể cập nhật giỏ hàng.", error);
      feedback.textContent = "Không thể lưu thay đổi giỏ hàng.";
    }
  });

  checkoutButton.addEventListener("click", () => {
    window.location.href = "index.html?checkout=1";
  });

  async function initialize() {
    readCart();
    try {
      const response = await fetch("products.xml");
      if (!response.ok) throw new Error(`products.xml trả về HTTP ${response.status}`);
      const xml = new DOMParser().parseFromString(await response.text(), "application/xml");
      if (xml.querySelector("parsererror")) throw new Error("products.xml không đúng định dạng XML.");
      products = [...xml.querySelectorAll("products > product")].map((node) => ({
        id: Number(node.getAttribute("id")),
        title: node.querySelector("title")?.textContent ?? "",
        price: Number(node.querySelector("price")?.textContent) || 0,
        stock: Number(node.getAttribute("stock")) || 0
      }));
      renderCart();
    } catch (error) {
      console.error("Không thể tải dữ liệu sản phẩm cho giỏ hàng.", error);
      feedback.textContent = "Không thể tải danh sách sản phẩm. Hãy mở website qua máy chủ web rồi thử lại.";
      renderCart();
    }
  }

  initialize();
})();
