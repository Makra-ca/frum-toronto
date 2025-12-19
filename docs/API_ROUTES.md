# API Routes

## Directory

### GET `/api/directory/categories`
Returns all parent categories with their subcategories and business counts.
Used by the Directory mega menu.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Food & Dining",
    "slug": "food-dining",
    "businessCount": 45,
    "subcategories": [
      { "id": 10, "name": "Restaurants", "slug": "restaurants", "businessCount": 20 },
      { "id": 11, "name": "Bakeries", "slug": "bakeries", "businessCount": 15 }
    ]
  }
]
```

---

### GET `/api/directory/search`
Search and filter businesses across all categories.
Used by the Directory search page.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search query (searches name, description, category) |
| `page` | number | Page number (default: 1) |
| `sort` | string | Sort order: `relevance`, `name-asc`, `name-desc`, `newest`, `popular` |
| `city` | string | Filter by city |
| `kosher` | boolean | Filter kosher only (`true`) |
| `kosherType` | string | Filter by kosher certification type |
| `category` | string | Filter by category slug |

**Response:**
```json
{
  "businesses": [
    {
      "id": 1,
      "name": "Business Name",
      "slug": "business-name",
      "description": "...",
      "address": "123 Main St",
      "city": "Toronto",
      "phone": "416-555-1234",
      "email": "info@example.com",
      "website": "https://example.com",
      "logoUrl": "...",
      "hours": {...},
      "isKosher": true,
      "kosherCertification": "COR",
      "isFeatured": false,
      "categoryId": 10,
      "categoryName": "Restaurants",
      "categorySlug": "restaurants"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalCount": 150,
    "totalPages": 8
  },
  "filters": {
    "applied": {
      "query": "",
      "city": null,
      "kosherOnly": false,
      "kosherType": null,
      "categorySlug": null,
      "sort": "relevance"
    },
    "available": {
      "cities": ["Toronto", "Thornhill", "Vaughan"],
      "kosherCertifications": ["COR", "MK"],
      "categories": [{ "id": 10, "name": "Restaurants", "slug": "restaurants" }]
    }
  }
}
```

---

### GET `/api/directory/[slug]`
Get businesses for a specific category by slug.
Used by category detail pages.

**Path Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `slug` | string | Category slug (e.g., `restaurants`) |

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `sort` | string | Sort order: `name-asc`, `name-desc`, `newest` |
| `q` | string | Search within category |
| `city` | string | Filter by city |
| `kosher` | boolean | Filter kosher only |

**Response:**
```json
{
  "category": {
    "id": 10,
    "name": "Restaurants",
    "slug": "restaurants",
    "parentId": 1
  },
  "parentCategory": {
    "name": "Food & Dining",
    "slug": "food-dining"
  },
  "siblings": [
    { "id": 10, "name": "Restaurants", "slug": "restaurants", "businessCount": 20 },
    { "id": 11, "name": "Bakeries", "slug": "bakeries", "businessCount": 15 }
  ],
  "businesses": [
    {
      "id": 1,
      "name": "Business Name",
      "slug": "business-name",
      "description": "...",
      "address": "123 Main St",
      "city": "Toronto",
      "phone": "416-555-1234",
      "website": "https://example.com",
      "isKosher": true,
      "kosherCertification": "COR"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalCount": 20,
    "totalPages": 1
  },
  "cities": ["Toronto", "Thornhill"]
}
```

---

## Classifieds

### GET `/api/classifieds/categories`
Returns classified categories with listing counts and recent listings.
Used by the Classifieds mega menu.

**Response:**
```json
{
  "categories": [
    {
      "id": 14,
      "name": "Jobs Available",
      "slug": "jobs-available",
      "listingCount": 5
    },
    {
      "id": 35,
      "name": "Apartment- Rental",
      "slug": "apartment-rental",
      "listingCount": 3
    }
  ],
  "recentListings": [
    {
      "id": 1660,
      "title": "2 bedroom basement apartment",
      "price": "2000.00",
      "priceType": "fixed",
      "createdAt": "2025-11-23T00:00:00.000Z",
      "categoryId": 35,
      "categoryName": "Apartment- Rental",
      "categorySlug": "apartment-rental"
    }
  ]
}
```

**Notes:**
- Only returns categories that have active, approved listings
- Recent listings limited to last 10 active, approved, non-expired listings
