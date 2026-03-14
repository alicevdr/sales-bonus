/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
  const { discount = 0, sale_price, quantity = 1 } = purchase;
  const discountCoefficient = 1 - discount / 100;
  return sale_price * quantity * discountCoefficient;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;
  if (index === 0) return profit * 0.15;
  else if (index === 1 || index === 2) return profit * 0.1;
  else if (index === total - 1) return 0;
  else return profit * 0.05;
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
  const { calculateRevenue, calculateBonus } = options;

  const purchaseData =
    data.purchase_record || data.purchase_records || data.purchases || [];

  if (
    !data ||
    (!Array.isArray(data.sellers) ||
      !Array.isArray(data.products) ||
      !Array.isArray(purchaseData)) ||
    (data.sellers.length === 0 ||
      data.products.length === 0 ||
      purchaseData.length === 0)
  ) {
    throw new Error("Некорректные входные данные");
  }

  if (!options || typeof options !== "object") {
    throw new Error("Некорректные опции");
  }

  if (
    !calculateRevenue ||
    !calculateBonus ||
    typeof calculateRevenue !== "function" ||
    typeof calculateBonus !== "function"
  ) {
    throw new Error("Отсутствуют необходимые функции для расчётов");
  }

  const sellerStats = data.sellers.map((seller) => ({
    seller_id: seller.id || seller.seller_id,
    name:
      seller.name ||
      `${seller.first_name || ""} ${seller.last_name || ""}`.trim(),
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {},
  }));

  const sellerIndex = Object.fromEntries(
    sellerStats.map((seller) => [seller.seller_id, seller]),
  );

  const productIndex = Object.fromEntries(
    data.products.map((product) => [product.sku || product.id, product]),
  );

  // ШАГ 5: Обработка чеков и покупок
  // Используем правильное название для чеков
  if (Array.isArray(purchaseData)) {
    purchaseData.forEach((record) => {
      const seller = sellerIndex[record.seller_id || record.sellerId];
      if (!seller) return;

      seller.sales_count++;

      let total_amount = 0;

      const items = record.items || record.products || [];

      // Обрабатываем каждый товар в чеке
      items.forEach((item) => {
        const product = productIndex[item.sku || item.product_id || item.id];
        if (!product) return;

        const cost =
          (product.purchase_price || product.cost || 0) * (item.quantity || 1);

        const revenue = calculateRevenue(
          {
            discount: item.discount || 0,
            sale_price: item.price || item.sale_price,
            quantity: item.quantity || 1,
          },
          product,
        );

        const profit = revenue - cost;

        seller.profit += profit;
        total_amount += revenue;

        const sku = item.sku || item.product_id || item.id;
        if (!seller.products_sold[sku]) {
          seller.products_sold[sku] = 0;
        }
        seller.products_sold[sku] += item.quantity || 1;
      });

      seller.revenue += total_amount;
    });
  }

  sellerStats.sort((a, b) => b.profit - a.profit);

  sellerStats.forEach((seller, index) => {
    seller.bonus = calculateBonus(index, sellerStats.length, seller);

    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  });

  return sellerStats.map((seller) => ({
    seller_id: seller.seller_id,
    name: seller.name,
    revenue: seller.revenue,
    profit: seller.profit,
    sales_count: seller.sales_count,
    top_products: seller.top_products,
    bonus: seller.bonus,
  }));
}
