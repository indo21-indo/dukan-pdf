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

// Serve static memo PDFs
app.use("/memos", express.static(path.join(__dirname, "memos")));

// Ensure memo folder exists
const memoFolder = path.join(__dirname, "memos");
if (!fs.existsSync(memoFolder)) {
  fs.mkdirSync(memoFolder);
}

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

  // Header
  doc.fontSize(18).text("Invoice", { align: "center" });

  const formattedDate = new Date().toLocaleString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
  doc.fontSize(12).text(`Date: ${formattedDate}`, { align: "center" });
  doc.moveDown();

  doc.fontSize(12).text("Product           Qty    Price    Total");
  doc.text("----------------------------------------");

  let grandTotal = 0;
  items.forEach(({ name, quantity, price }) => {
    const total = quantity * price;
    grandTotal += total;
    const namePad = name.padEnd(16);
    const qtyPad = String(quantity).padEnd(6);
    const pricePad = price.toFixed(2).padEnd(8);
    doc.text(`${namePad} ${qtyPad} ${pricePad} ${total.toFixed(2)}`);
  });

  doc.text("----------------------------------------");
  doc.text(`Total: ${grandTotal.toFixed(2)}`, { align: "right" });
  doc.text(`Paid: ${paid.toFixed(2)}`, { align: "right" });
  doc.text(`Due: ${(grandTotal - paid).toFixed(2)}`, { align: "right" });
  doc.moveDown();
  doc.fontSize(14).text("Thanks for shopping!", { align: "center" });

  doc.end();

  writeStream.on("finish", () => {
    const fileUrl = `${req.protocol}://${req.get("host")}/memos/${fileName}`;
    res.json({ pdfUrl: fileUrl });
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
