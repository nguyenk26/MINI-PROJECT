# Cấu trúc dữ liệu mini-project bán hàng

Các tệp dữ liệu mẫu dùng UTF-8. Giá sản phẩm và hóa đơn được giữ theo USD như dữ liệu Fake Store API; các mật khẩu và thông tin cá nhân đều là dữ liệu giả lập.

## `products.xml`

Nguồn sản phẩm: [Fake Store API](https://fakestoreapi.com/products). Danh sách sản phẩm được chuyển sang XML bằng DOM; màu sắc và tồn kho là dữ liệu bổ sung cho mini-project.

- `<products>`: `schemaVersion`, `source`, `generatedAt`.
- `<product>`: `id` (ID nguồn), `sku`, `color`, `stock`, `active`.
- Các phần tử con: `title`, `price`, `currency`, `description`, `category`, `image`, `rating/rate`, `rating/count`.

## `employees.json` và `customers.json`

Mỗi tệp là một object JSON gồm `schemaVersion`, `generatedAt` và một mảng bản ghi tương ứng.

- Cả hai loại tài khoản có `id`, `fullName`, `username`, `email`, `password`, `role`, `phone`, `status`, `createdAt`.
- Nhân viên có thêm `department`; ba nhân viên đầu tiên có vai trò `admin`, phù hợp để kiểm tra Dashboard Admin.
- Khách hàng có thêm `loyaltyPoints` và `address` (`street`, `district`, `city`, `country`, `postalCode`).
- Đăng nhập demo có thể dùng `username` hoặc `email`. Ví dụ: `employee01` / `EmpDemo!01`; khách hàng: `customer001` / `CustDemo!001`.
- Mật khẩu lưu dạng rõ chỉ để phục vụ đăng nhập giả lập phía client. Không dùng cấu trúc này cho hệ thống thật; backend cần băm mật khẩu và quản lý xác thực an toàn.

## `carts.xml`

Tệp chứa 200 hóa đơn mẫu. Dù tên tệp là `carts.xml`, phần tử gốc là `<invoices>` để biểu diễn danh sách hóa đơn.

- `<invoice>`: `id` duy nhất, `createdAt` theo ISO 8601 UTC, `status`, `employeeId`, `customerId`.
- `employeeId`, `customerId` tham chiếu ID trong hai tệp JSON; `productId` trong từng `<item>` tham chiếu `products.xml`.
- `<payment>` lưu phương thức và trạng thái thanh toán; `<shippingAddress>` lưu ảnh chụp thông tin giao hàng tại thời điểm đặt hàng.
- `<items>/<item>` lưu sản phẩm, SKU, đơn giá, số lượng, phần trăm giảm giá và thành tiền từng dòng.
- `<totals>` lưu tạm tính, giảm giá, thuế, phí giao hàng và tổng thanh toán. Dữ liệu mẫu áp dụng thuế 8%, miễn phí giao hàng từ $100; dưới ngưỡng là $5.99.
- Trạng thái đơn hàng mẫu: `completed`, `shipped`, `processing`, `pending`, `cancelled`, `refunded`.

## `reviews.xml`

- `<reviews>` chứa `schemaVersion`, `generatedAt`, `source` và các phần tử `<review>`.
- Mỗi đánh giá có `review_id` duy nhất cùng các phần tử `product_id`, `customer_id`, `rating` (1–5), `comment`, `created_at`.
- `product_id` tham chiếu ID trong `products.xml`; `customer_id` tham chiếu ID trong `customers.json`. Một khách có thể đánh giá nhiều sản phẩm và một sản phẩm có nhiều đánh giá.
- Trang chủ đọc XML bằng `DOMParser`, gom điểm theo `product_id`, tính trung bình và cập nhật điểm/số lượng review trên thẻ sản phẩm. Nút **Rating Detail** mở danh sách điểm, nhận xét, ngày đánh giá và tên khách hàng.
- Trên màn hình điện thoại, bộ lọc mở thành thanh trượt từ cạnh trái; danh sách sản phẩm không bị đẩy xuống dưới khu vực bộ lọc.

Các file là dữ liệu tĩnh để xây dựng giao diện, đăng nhập demo, giỏ hàng/checkout và thống kê dashboard; ứng dụng có thể nạp chúng bằng `fetch` khi chạy qua web server.

## Trạng thái trình duyệt

- `localStorage.shoppingCart` lưu object `{ items, currency, updatedAt }`; mỗi item có `productId`, `variant` (màu), `size` (để mở rộng), `quantity` và thông tin sản phẩm cần thiết để hiển thị giỏ hàng. Các mục giỏ cũ lưu dưới dạng mảng cũng được đọc để tương thích.
- `localStorage.currentUser` lưu phiên demo đã đăng nhập (không lưu mật khẩu). Vai trò `customer` được phép thanh toán; tài khoản nhân viên đăng nhập được nhưng không thể đặt hàng với vai trò khách hàng.
- `localStorage.completedOrders` lưu đơn thanh toán giả lập cùng địa chỉ giao hàng, mặt hàng, tổng tiền và trạng thái thanh toán demo.
- Trước khi lưu đơn, biểu mẫu kiểm tra email và số điện thoại Việt Nam bằng biểu thức chính quy; dữ liệu đơn và giỏ chỉ tồn tại trong trình duyệt, không thay thế backend hay cổng thanh toán thật.

## Dashboard nhân viên

- Tài khoản nhân viên đăng nhập sẽ được chuyển tới `dashboard.html`; trang kiểm tra vai trò từ `localStorage.currentUser` và không cho tài khoản khách hàng xem số liệu.
- Dashboard tổng hợp hóa đơn mẫu từ `carts.xml` và đơn demo đã thanh toán từ `localStorage.completedOrders`; doanh thu/sản phẩm bán chỉ tính đơn có trạng thái thanh toán `paid`, loại trừ đơn hủy và hoàn tiền.
- Có thể lọc thống kê theo trạng thái và khoảng ngày; dữ liệu hiển thị gồm số đơn, đơn đã thanh toán, doanh thu, tổng số lượng bán, sản phẩm bán chạy và danh sách hóa đơn.
