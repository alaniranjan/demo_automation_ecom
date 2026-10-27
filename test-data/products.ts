export interface Category {
  /** Breadcrumb / page heading shown on the listing page. */
  readonly heading: string;
  /** Listing path, relative to BASE_URL. */
  readonly path: string;
  /** Text of the header or footer link that opens it. */
  readonly linkText: string;
}

/** Top-level catalog sections. The header shows Women's, Men's and Kids; the footer adds Accessories. */
export const Categories = {
  men: { heading: 'Mens', path: '/product-list/Mens?l=List_page_01', linkText: "Men's" },
  women: { heading: 'Womens', path: '/product-list/Womens?l=List_page_01', linkText: "Women's" },
  kids: { heading: 'kids', path: '/product-list/kids?l=List_page_01', linkText: 'Kids' },
  accessories: { heading: 'accessories', path: '/product-list/accessories?l=List_page_01', linkText: 'Accessories' },
} as const satisfies Record<string, Category>;

/** Sub-collections reached from the footer; their breadcrumb shows the parent collection. */
export const SubCategories = {
  menTopWear: { heading: 'Mens', path: "/product-list/Mens/men's-top-wear?l=List_page_01", linkText: 'Top Wear' },
  womenSarees: { heading: 'Womens', path: "/product-list/Womens/women's-sarees?l=List_page_01", linkText: 'Sarees' },
} as const satisfies Record<string, Category>;

export interface Product {
  /** URL slug after /product/. */
  readonly slug: string;
  readonly name: string;
  /** Sizes offered on the product page, in display order. */
  readonly sizes: readonly string[];
}

/**
 * Hand-picked products featured on the home page. The live catalog can change; if one disappears, update its
 * slug here. Prices are not pinned: tests read them from the page and check relationships (price <= MRP, totals).
 */
export const Products = {
  muscleVest: {
    slug: 'super-combed-cotton-rib-solid-round-neck-muscle-vest-graphite-hck00053',
    name: 'Super Combed Cotton Rib Solid Round Neck Muscle Vest - Graphite',
    sizes: ['S', 'M', 'L', 'XL'],
  },
  regularShorts: {
    slug: 'super-combed-cotton-rich-regular-fit-shorts-with-side-pockets-grey-melange-navy-hck00037',
    name: 'Super Combed Cotton Rich Regular Fit Shorts with Side Pockets - Grey Melange & Navy',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
  },
} as const satisfies Record<string, Product>;

/** Sort dropdown on listing pages: visible label -> `sort` query value. The store sorts by MRP, not sale price. */
export const SortOption = {
  Featured: { label: 'Featured', value: '3' },
  Newest: { label: 'Newest', value: '4' },
  PriceLowToHigh: { label: 'Price: Low-High', value: '2' },
  PriceHighToLow: { label: 'Price: High-Low', value: '1' },
} as const;
export type SortOption = (typeof SortOption)[keyof typeof SortOption];

export const SearchTerms = {
  matching: 'shirt',
  matchingUpperCase: 'SHIRT',
  noResults: 'zzqx-no-such-product',
} as const;
