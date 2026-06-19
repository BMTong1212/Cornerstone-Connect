/**
 * Default directory data for Cornerstone Connect
 * Seeded with local businesses in Slidell, LA.
 */
const DEFAULT_DIRECTORY = [
  {
    id: "ohns-01",
    name: "Oak Harbor Nail Spa",
    category: "Beauty & Wellness",
    owner: "Mindy Tong",
    phone: "(985) 288-4048",
    email: "info@oakharbornailspa.com",
    website: "https://oak-harbor-ritual-house.vercel.app",
    address: "131 Oak Ct, Suite B, Slidell, LA 70458",
    social: "@oakharbornailspa",
    notes: "A Modern Ritual House. Offering unhurried and premium pedicure rituals in a quiet luxury atmosphere.",
    isFeatured: true
  },
  {
    id: "sl-cafe-02",
    name: "Olde Towne Coffee House",
    category: "Food & Beverage",
    owner: "Sarah Jenkins",
    phone: "(985) 643-9993",
    email: "olde.towne.coffee@example.com",
    website: "https://www.oldetownecoffeehouse.com",
    address: "338 Carey St, Slidell, LA 70458",
    social: "@oldetownecoffee",
    notes: "Local favorite in Olde Towne Slidell. Excellent house roasts, breakfast pastries, and community workspace.",
    isFeatured: false
  },
  {
    id: "sl-re-03",
    name: "Amanda Miller Realty Group",
    category: "Real Estate",
    owner: "Amanda Miller",
    phone: "(985) 290-3375",
    email: "amanda@amandamillerrealty.com",
    website: "https://amandamillerrealty.com",
    address: "2050 Gause Blvd E, Slidell, LA 70461",
    social: "@amandamillerrealty",
    notes: "Trusted Slidell real estate specialists. Extensive local network and Northshore community knowledge.",
    isFeatured: false
  },
  {
    id: "sl-cpa-04",
    name: "Northshore Tax Partners",
    category: "Professional Services",
    owner: "Robert Davis, CPA",
    phone: "(985) 641-1040",
    email: "r.davis@northshoretax.com",
    website: "https://www.northshoretaxpartners.com",
    address: "100 Professional Pkwy, Slidell, LA 70458",
    social: "",
    notes: "Local small business tax strategies, accounting, and financial advisory. Very reliable and detail-oriented.",
    isFeatured: false
  },
  {
    id: "sl-plumb-05",
    name: "Bourgeois Plumbing & HVAC",
    category: "Home Services",
    owner: "Marc Bourgeois",
    phone: "(985) 649-6232",
    email: "service@bourgeoisplumbing.com",
    website: "https://bourgeoisplumbing.com",
    address: "2024 Shortcut Hwy, Slidell, LA 70458",
    social: "@bourgeoisplumbing",
    notes: "Highly professional plumbing, drain cleaning, and AC services in Slidell. Fast emergency response.",
    isFeatured: false
  },
  {
    id: "sl-bout-06",
    name: "Posh Boutique Slidell",
    category: "Retail & Boutiques",
    owner: "Elena Martinez",
    phone: "(985) 781-8880",
    email: "elena@poshboutiqueslidell.com",
    website: "https://poshboutiqueslidell.com",
    address: "1810 Gause Blvd West, Slidell, LA 70460",
    social: "@poshboutique_slidell",
    notes: "Chic local boutique for women's apparel, accessories, and unique gifts. Excellent customer service.",
    isFeatured: false
  }
];

// Available default categories
const CATEGORIES = [
  "Beauty & Wellness",
  "Real Estate",
  "Home Services",
  "Professional Services",
  "Food & Beverage",
  "Retail & Boutiques",
  "Health & Medical",
  "Other"
];

// Export to make available in browser environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEFAULT_DIRECTORY, CATEGORIES };
}
