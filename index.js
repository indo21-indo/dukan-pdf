// index.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use("/memos", express.static(path.join(__dirname, "memos")));
app.use(express.static(path.join(__dirname, "public")));

const memoFolder = path.join(__dirname, "memos");
if (!fs.existsSync(memoFolder)) {
  fs.mkdirSync(memoFolder);
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/memo", (req, res) => {
  const itemsParam = req.query.items;
  const paid = parseFloat(req.query.paid || 0);

  if (!itemsParam) {
    return res.status(400).json({ error: "Missing items" });
  }

  const items = itemsParam.split(",").map((itemStr) => {
    const [name, qty, price] = itemStr.split(":");
    return {
      name,
      quantity: parseInt(qty),
      price: parseFloat(price),
    };
  });

  const doc = new PDFDocument();
  const fileName = `memo_${Date.now()}.pdf`;
  const filePath = path.join(memoFolder, fileName);
  const writeStream = fs.createWriteStream(filePath);
  doc.pipe(writeStream);

  // ===== PDF DESIGN START =====
  doc.rect(50, 50, 500, 700).stroke(); // outer border (optional)

  doc.fontSize(20).fillColor("#333").text("🧾 Invoice", { align: "center" });
  doc.moveDown(0.5);

  const formattedDate = new Date().toLocaleString("en-US", {
    day: "numeric", month: "long", year: "numeric",
    hour: "numeric", minute: "numeric", hour12: true,
  });
  doc.fontSize(12).fillColor("#444").text(`Date: ${formattedDate}`, { align: "center" });
  doc.moveDown(1.2);

  // Header row
  doc.fontSize(12).fillColor("#000").text("Product", 70)
    .text("Qty", 240)
    .text("Price", 300)
    .text("Total", 400);
  doc.moveTo(70, doc.y + 3).lineTo(520, doc.y + 3).stroke();

  let grandTotal = 0;
  doc.moveDown(0.5);

  // Product rows
  items.forEach(({ name, quantity, price }) => {
    const total = quantity * price;
    grandTotal += total;

    doc.text(name, 70)
      .text(quantity.toString(), 240)
      .text(price.toFixed(2), 300)
      .text(total.toFixed(2), 400);
    doc.moveDown(0.3);
  });

  doc.moveDown(0.5);
  doc.moveTo(70, doc.y).lineTo(520, doc.y).stroke();
  doc.moveDown(0.5);

  // Totals
  doc.fontSize(12).fillColor("#000");
  doc.text(`Total:`, 300, doc.y, { continued: true }).text(`${grandTotal.toFixed(2)}`, 400);
  doc.text(`Paid:`, 300, doc.y, { continued: true }).text(`${paid.toFixed(2)}`, 400);
  doc.text(`Due:`, 300, doc.y, { continued: true }).text(`${(grandTotal - paid).toFixed(2)}`, 400);

  doc.moveDown(2);
  doc.fontSize(14).fillColor("#007BFF").text("Thank you for shopping with us!", { align: "center" });
  // ===== PDF DESIGN END =====

  doc.end();

  writeStream.on("finish", () => {
    const fileUrl = `${req.protocol}://${req.get("host")}/memos/${fileName}`;
    res.json({ pdfUrl: fileUrl });
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
