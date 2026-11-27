/**
 * Deterministic seed-data generator.
 * Writes apps/web/src/data/seed.json — the single source of truth for
 * both the Prisma seed (prisma/seed.ts) and the no-DB storefront.
 * Run: node scripts/generate-seed.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "apps/web/src/data/seed.json");

// mulberry32 — deterministic so the seed never changes between runs.
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261127);

/** [slug, nameFa, nameEn, [ [productFa, basePriceToman], ... ]] per leaf. */
const TREE = [
  {
    slug: "fruits-vegetables", fa: "میوه و سبزیجات", en: "Fruits & Vegetables",
    children: [
      {
        slug: "fresh-fruit", fa: "میوه تازه", en: "Fresh Fruit",
        children: [
          { slug: "apples-pears", fa: "سیب و گلابی", en: "Apples & Pears", products: [["سیب قرمز ارگانیک", 89000], ["سیب زرد", 79000], ["گلابی بیروتی", 129000], ["سیب ترش محلی", 69000], ["گلابی آسیایی", 149000]] },
          { slug: "citrus", fa: "مرکبات", en: "Citrus", products: [["پرتقال تامسون", 99000], ["لیمو ترش", 119000], ["نارنگی", 109000], ["گریپ‌فروت", 89000], ["لیمو شیرین", 95000]] },
          { slug: "summer-fruits", fa: "میوه‌های تابستانی", en: "Summer Fruits", products: [["هلو انجیری", 139000], ["شلیل", 129000], ["زردآلو", 159000], ["گیلاس", 289000], ["آلو قرمز", 119000]] },
        ],
      },
      {
        slug: "vegetables", fa: "سبزیجات", en: "Vegetables",
        children: [
          { slug: "leafy-greens", fa: "سبزی خوردن", en: "Leafy Greens", products: [["سبزی خوردن تازه", 45000], ["ریحان بنفش", 39000], ["تره و جعفری", 35000], ["کاهو فرانسوی", 49000], ["اسفناج تازه", 55000]] },
          { slug: "root-vegetables", fa: "سبزیجات ریشه‌ای", en: "Root Vegetables", products: [["هویج ارگانیک", 59000], ["چغندر", 69000], ["سیب‌زمینی", 49000], ["پیاز قرمز", 55000], ["تربچه", 45000]] },
        ],
      },
      {
        slug: "summer-crops", fa: "صیفی‌جات", en: "Summer Crops",
        children: [
          { slug: "tomato-cucumber", fa: "گوجه و خیار", en: "Tomatoes & Cucumbers", products: [["گوجه گیلاسی", 99000], ["گوجه فرنگی", 69000], ["خیار گلخانه‌ای", 79000], ["خیار چنبر", 89000], ["فلفل دلمه‌ای", 119000]] },
          { slug: "melons", fa: "خربزه و هندوانه", en: "Melons", products: [["هندوانه", 39000], ["خربزه", 59000], ["طالبی", 69000], ["گرمک", 79000]] },
        ],
      },
    ],
  },
  {
    slug: "dairy", fa: "لبنیات", en: "Dairy",
    children: [
      {
        slug: "milk-yogurt", fa: "شیر و ماست", en: "Milk & Yogurt",
        children: [
          { slug: "milk", fa: "شیر", en: "Milk", products: [["شیر تازه گاو", 89000], ["شیر بز", 129000], ["شیر کم‌چرب", 79000], ["دوغ محلی", 49000]] },
          { slug: "yogurt", fa: "ماست", en: "Yogurt", products: [["ماست چکیده", 99000], ["ماست موسیر", 109000], ["ماست پروبیوتیک", 89000], ["کشک مایع", 79000]] },
        ],
      },
      {
        slug: "cheese", fa: "پنیر", en: "Cheese",
        children: [
          { slug: "traditional-cheese", fa: "پنیر سنتی", en: "Traditional Cheese", products: [["پنیر لیقوان", 389000], ["پنیر تبریزی", 329000], ["پنیر کردی", 299000], ["پنیر دودی", 359000]] },
          { slug: "fresh-cheese", fa: "پنیر تازه", en: "Fresh Cheese", products: [["پنیر خامه‌ای", 189000], ["پنیر موزارلا", 219000], ["پنیر فتا", 249000], ["پنیر محلی تازه", 179000]] },
        ],
      },
      {
        slug: "butter-cream", fa: "کره و خامه", en: "Butter & Cream",
        children: [
          { slug: "butter", fa: "کره", en: "Butter", products: [["کره حیوانی", 289000], ["کره محلی", 259000], ["کره گیاهی", 199000]] },
          { slug: "cream", fa: "خامه", en: "Cream", products: [["خامه صبحانه", 129000], ["خامه قنادی", 149000], ["سرشیر", 169000]] },
        ],
      },
    ],
  },
  {
    slug: "bread-grains", fa: "نان و غلات", en: "Bread & Grains",
    children: [
      {
        slug: "bread", fa: "نان", en: "Bread",
        children: [
          { slug: "sangak", fa: "سنگک", en: "Sangak", products: [["نان سنگک سبوس‌دار", 45000], ["نان سنگک کنجدی", 55000], ["نان سنگک کامل", 49000]] },
          { slug: "barbari", fa: "بربری", en: "Barbari", products: [["نان بربری تازه", 39000], ["نان بربری سبوس‌دار", 45000], ["نان بربری کنجدی", 49000]] },
        ],
      },
      {
        slug: "grains", fa: "غلات", en: "Grains",
        children: [
          { slug: "rice", fa: "برنج", en: "Rice", products: [["برنج طارم", 189000], ["برنج هاشمی", 219000], ["برنج قهوه‌ای", 149000], ["برنج دودی", 239000]] },
          { slug: "legumes", fa: "حبوبات", en: "Legumes", products: [["عدس سبز", 129000], ["نخود", 119000], ["لوبیا قرمز", 139000], ["ماش", 109000]] },
        ],
      },
      {
        slug: "flour", fa: "آرد", en: "Flour",
        children: [
          { slug: "whole-flour", fa: "آرد کامل", en: "Whole Flour", products: [["آرد گندم کامل", 99000], ["آرد جو", 89000], ["آرد برنج", 109000]] },
        ],
      },
    ],
  },
  {
    slug: "honey-jam", fa: "عسل و مربا", en: "Honey & Jam",
    children: [
      {
        slug: "honey", fa: "عسل", en: "Honey",
        children: [
          { slug: "mountain-honey", fa: "عسل کوهی", en: "Mountain Honey", products: [["عسل کوهی چندگل", 890000], ["عسل آویشن", 990000], ["عسل گون", 790000]] },
          { slug: "blossom-honey", fa: "عسل شکوفه", en: "Blossom Honey", products: [["عسل بهارنارنج", 690000], ["عسل اقاقیا", 750000], ["عسل کنار", 850000]] },
        ],
      },
      {
        slug: "jam", fa: "مربا", en: "Jam",
        children: [
          { slug: "sour-cherry-jam", fa: "مربای آلبالو", en: "Sour Cherry Jam", products: [["مربای آلبالو", 189000], ["مربای گیلاس", 199000], ["مربای توت‌فرنگی", 179000]] },
          { slug: "quince-jam", fa: "مربای به", en: "Quince Jam", products: [["مربای به", 169000], ["مربای هویج", 149000], ["مربای بالنگ", 189000]] },
        ],
      },
    ],
  },
  {
    slug: "oils-spices", fa: "روغن و ادویه", en: "Oils & Spices",
    children: [
      {
        slug: "oils", fa: "روغن", en: "Oils",
        children: [
          { slug: "olive-oil", fa: "روغن زیتون", en: "Olive Oil", products: [["روغن زیتون فرابکر", 590000], ["روغن زیتون تصفیه‌شده", 390000], ["روغن زیتون محلی", 490000]] },
          { slug: "sesame-oil", fa: "روغن کنجد", en: "Sesame Oil", products: [["روغن کنجد پرس سرد", 490000], ["روغن کنجد بوداده", 550000], ["روغن نارگیل", 450000]] },
        ],
      },
      {
        slug: "spices", fa: "ادویه", en: "Spices",
        children: [
          { slug: "saffron", fa: "زعفران", en: "Saffron", products: [["زعفران قائنات", 1290000], ["زعفران سرگل", 1490000], ["زعفران نگین", 1690000]] },
          { slug: "turmeric-herbs", fa: "زردچوبه و سبزی خشک", en: "Turmeric & Herbs", products: [["زردچوبه", 189000], ["سبزی خشک معطر", 99000], ["پودر فلفل قرمز", 129000]] },
        ],
      },
    ],
  },
  {
    slug: "drinks", fa: "نوشیدنی‌ها", en: "Drinks",
    children: [
      {
        slug: "juices", fa: "آبمیوه", en: "Juices",
        children: [
          { slug: "pomegranate-juice", fa: "آب انار", en: "Pomegranate Juice", products: [["آب انار طبیعی", 149000], ["آب سیب طبیعی", 129000], ["آب هویج", 119000]] },
          { slug: "herbal-drinks", fa: "نوشیدنی گیاهی", en: "Herbal Drinks", products: [["عرق نعناع", 99000], ["عرق کاسنی", 89000], ["گلاب قمصر", 129000]] },
        ],
      },
      {
        slug: "teas", fa: "دمنوش", en: "Teas",
        children: [
          { slug: "herbal-tea", fa: "دمنوش گیاهی", en: "Herbal Tea", products: [["دمنوش بابونه", 139000], ["دمنوش گل گاوزبان", 159000], ["چای ترش", 119000], ["دمنوش نعناع", 99000]] },
        ],
      },
    ],
  },
];

const VENDORS = [
  ["v01", "باغ سبز کرج", "bagh-sabz-karaj", "کرج"],
  ["v02", "مزرعه ارگانیک دماوند", "mazrae-damavand", "دماوند"],
  ["v03", "لبنیات سنتی لیقوان", "labaniyat-lighvan", "تبریز"],
  ["v04", "کندوی کوهستان", "kandou-koohestan", "اردبیل"],
  ["v05", "نانوایی سنگکی آرد کامل", "nanvai-sangak", "تهران"],
  ["v06", "باغ مرکبات شمال", "bagh-shomal", "رشت"],
  ["v07", "مزرعه زعفران قائنات", "zaferan-ghaenat", "قائنات"],
  ["v08", "روغن‌کشی پرس سرد", "roghan-press", "اصفهان"],
  ["v09", "باغ انار ساوه", "bagh-anar-saveh", "ساوه"],
  ["v10", "دامداری سبزوار", "damdari-sabzevar", "سبزوار"],
  ["v11", "کشاورزی ارگانیک شیراز", "keshavarzi-shiraz", "شیراز"],
  ["v12", "عرقیات قمصر", "araghiyat-ghamsar", "کاشان"],
];

const categories = [];
const leaves = [];
let sortOrder = 0;
function walk(nodes, parentId) {
  for (const node of nodes) {
    const id = node.slug;
    categories.push({ id, parentId, slug: node.slug, nameFa: node.fa, nameEn: node.en, sortOrder: sortOrder++ });
    if (node.products) leaves.push(node);
    if (node.children) walk(node.children, id);
  }
}
walk(TREE, null);

const products = [];
let n = 0;
for (const leaf of leaves) {
  // 4 products per leaf, 5 for the first four leaves → exactly 120.
  const count = leaves.indexOf(leaf) < 4 ? 5 : 4;
  for (let i = 0; i < count; i++) {
    n += 1;
    const [title, basePrice] = leaf.products[i % leaf.products.length];
    const vendor = VENDORS[(n - 1) % VENDORS.length];
    const price = Math.round((basePrice * (0.9 + rand() * 0.2)) / 5000) * 5000;
    const stock = rand() < 0.08 ? 0 : 3 + Math.floor(rand() * 45);
    const rating = Math.round((3.6 + rand() * 1.4) * 10) / 10;
    products.push({
      id: `p${String(n).padStart(3, "0")}`,
      vendorId: vendor[0],
      categoryId: leaf.slug,
      title: `${title} — ${vendor[1]}`,
      slug: `${leaf.slug}-${n}`,
      description: `${title} تازه و باکیفیت از ${vendor[1]} (${vendor[3]})؛ برداشت روز، بدون افزودنی و با بسته‌بندی بهداشتی ارسال می‌شود.`,
      price,
      compareAtPrice: rand() < 0.25 ? Math.round((price * 1.15) / 5000) * 5000 : null,
      stock,
      status: "PUBLISHED",
      organic: rand() < 0.6,
      glutenFree: leaf.slug === "whole-flour" || leaf.slug === "rice" ? true : rand() < 0.2,
      // Locally produced: deterministic from the product number so the
      // rand() stream (and therefore every other value) stays unchanged.
      local: n % 3 !== 0,
      rating,
    });
  }
}

const data = {
  categories,
  vendors: VENDORS.map(([id, shopName, slug, city]) => ({
    id, shopName, slug, city,
    rating: Math.round((4.1 + rand() * 0.8) * 10) / 10,
    status: "APPROVED",
  })),
  products,
  plans: [
    { id: "plan-box-weekly", kind: "BOX", title: "باکس هفتگی سبزینه", price: 890000, periodDays: 7, features: { items: 8, deliveryDay: "Thursday", swapAllowed: true } },
    { id: "plan-box-biweekly", kind: "BOX", title: "باکس دوهفته‌ای سبزینه", price: 1650000, periodDays: 14, features: { items: 10, deliveryDay: "Thursday", swapAllowed: true } },
    { id: "plan-vendor-basic", kind: "VENDOR", title: "پلن پایه فروشنده", price: 290000, periodDays: 30, features: { maxProducts: 20, commissionRate: 0.12 } },
    { id: "plan-vendor-pro", kind: "VENDOR", title: "پلن حرفه‌ای فروشنده", price: 590000, periodDays: 30, features: { maxProducts: 200, commissionRate: 0.08 } },
  ],
  discounts: [
    { code: "SABZ10", type: "PERCENT", value: 10, minAmount: 200000, usageLimit: 500 },
    { code: "BOX20", type: "PERCENT", value: 20, minAmount: 500000, usageLimit: 200 },
    { code: "WELCOME", type: "FIXED", value: 50000, minAmount: 150000, usageLimit: 1000 },
  ],
  banners: [
    { id: "banner-box", title: "باکس هفتگی سبزینه — تازه از مزرعه تا خانه", imageUrl: "", linkUrl: "/fa/subscribe", placement: "HOME_HERO", active: true },
    { id: "banner-organic", title: "محصولات ارگانیک با ضمانت تازگی", imageUrl: "", linkUrl: "/fa/category/fruits-vegetables", placement: "HOME_STRIP", active: true },
  ],
  demoUsers: [
    { email: "admin@sabzineh.ir", name: "مدیر سبزینه", role: "ADMIN", vendorId: null },
    { email: "vendor@sabzineh.ir", name: "باغ سبز کرج", role: "VENDOR", vendorId: "v01" },
    { email: "customer@sabzineh.ir", name: "مشتری سبزینه", role: "CUSTOMER", vendorId: null },
  ],
};

writeFileSync(outPath, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(`wrote ${outPath}`);
console.log(`categories=${categories.length} leaves=${leaves.length} vendors=${VENDORS.length} products=${products.length}`);
