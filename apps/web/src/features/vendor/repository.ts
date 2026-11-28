import type {
  PrismaClient,
  Product as PrismaProduct,
  ProductImage as PrismaProductImage,
  VendorProfile as PrismaVendorProfile,
} from "@prisma/client";
import type {
  VendorProductInput,
  VendorProductStatus,
  VendorProfileDTO,
  VendorProfileUpdate,
  ProductDTO,
} from "@sabzineh/types";
import { getPrismaClient } from "@/lib/prisma";
import { products as seedProducts, vendors as seedVendors } from "@/data/seed";
import { getProductImages, setProductImages } from "@/data/product-images";

/**
 * Vendor repository — one interface, two adapters (same pattern as the
 * catalog repository and the order store). Prisma when DATABASE_URL is
 * set, otherwise the seed/memory adapter.
 *
 * Every method is scoped by vendorId: a vendor can only read or
 * mutate rows of their own profile. The service layer enforces the
 * same rule on the session, but the repository never trusts a caller
 * that passes another vendor's id — get/update/setStatus all re-check
 * ownership and return null when the row belongs to someone else.
 *
 * In memory mode, vendor-created products are appended to the same
 * seed `products` array the catalog reads, so a PUBLISHED product
 * shows up in the storefront in the same process. Drafts never leak:
 * the catalog only lists PUBLISHED products (see repository.ts).
 */

export interface VendorProductListParams {
  q?: string;
  status?: VendorProductStatus;
}

/** A vendor's own product with its editable attributes (edit form). */
export interface VendorProductDetail extends ProductDTO {
  tags: string[];
  originNote: string | null;
}

export interface VendorRepository {
  listVendorProducts(vendorId: string, params?: VendorProductListParams): Promise<ProductDTO[]>;
  getVendorProduct(vendorId: string, id: string): Promise<VendorProductDetail | null>;
  createVendorProduct(
    vendorId: string,
    input: VendorProductInput,
    status: VendorProductStatus,
    slug: string,
  ): Promise<VendorProductDetail>;
  updateVendorProduct(
    vendorId: string,
    id: string,
    input: VendorProductInput,
  ): Promise<VendorProductDetail | null>;
  setVendorProductStatus(
    vendorId: string,
    id: string,
    status: VendorProductStatus,
  ): Promise<VendorProductDetail | null>;
  /** Admin moderation (Phase 3): every product, any vendor/status. */
  listAllProducts(params?: VendorProductListParams): Promise<ProductDTO[]>;
  /** Admin moderation (Phase 3): set status without an owner check. */
  setProductStatusAsAdmin(
    id: string,
    status: VendorProductStatus,
  ): Promise<VendorProductDetail | null>;
  getVendorProfileByUserId(userId: string): Promise<VendorProfileDTO | null>;
  getVendorProfileById(vendorId: string): Promise<VendorProfileDTO | null>;
  getVendorProfileBySlug(slug: string): Promise<VendorProfileDTO | null>;
  updateVendorProfile(vendorId: string, input: VendorProfileUpdate): Promise<VendorProfileDTO>;
  createVendorProfile(
    userId: string,
    input: { shopName: string; slug: string; city: string; bio?: string },
  ): Promise<VendorProfileDTO>;
  listPendingVendorProfiles(): Promise<VendorProfileDTO[]>;
  /**
   * Admin approval (Week 6): PENDING → APPROVED or REJECTED.
   * The rejection reason is stored so the vendor can see it on
   * their dashboard. Returns null when the profile does not exist.
   */
  setVendorProfileStatus(
    vendorId: string,
    status: "APPROVED" | "REJECTED",
    rejectionReason?: string | null,
  ): Promise<VendorProfileDTO | null>;
}

function withImages(product: ProductDTO): ProductDTO {
  const images = getProductImages(product.id).map((i) => i.url);
  return images.length > 0 ? { ...product, images } : product;
}

/** Tags/origin notes of memory-created products (Product.attributes in Prisma). */
const memoryAttributes = new Map<string, { tags: string[]; originNote: string | null }>();

function toDetail(product: ProductDTO): VendorProductDetail {
  const attrs = memoryAttributes.get(product.id);
  return { ...withImages(product), tags: attrs?.tags ?? [], originNote: attrs?.originNote ?? null };
}

// ---------------------------------------------------------------------------
// Seed/memory adapter (no database)
// ---------------------------------------------------------------------------

function seedProfileToDTO(
  v: { id: string; shopName: string; slug: string; city: string; rating: number },
  userId: string,
  overrides?: Partial<VendorProfileDTO>,
): VendorProfileDTO {
  return {
    id: v.id,
    userId,
    shopName: v.shopName,
    slug: v.slug,
    city: v.city,
    bio: null,
    status: "APPROVED",
    rejectionReason: null,
    rating: v.rating,
    phone: null,
    logoUrl: null,
    payoutIban: null,
    payoutAccountHolder: null,
    ...overrides,
  };
}

export class MemoryVendorRepository implements VendorRepository {
  /** Profiles created after boot (registrations) + edits to seed ones. */
  private profiles = new Map<string, VendorProfileDTO>();

  private seedProfile(id: string): VendorProfileDTO | null {
    const vendor = seedVendors.find((v) => v.id === id);
    if (!vendor) return null;
    // The demo vendor account (u-vendor) owns v01; other seed vendors
    // have no login yet — their userId is a stable placeholder.
    return seedProfileToDTO(vendor, id === "v01" ? "u-vendor" : `seed-${id}`);
  }

  private getProfile(id: string): VendorProfileDTO | null {
    return this.profiles.get(id) ?? this.seedProfile(id);
  }

  private putProfile(profile: VendorProfileDTO): void {
    this.profiles.set(profile.id, profile);
  }

  async listVendorProducts(vendorId: string, params?: VendorProductListParams): Promise<ProductDTO[]> {
    let items = seedProducts.filter((p) => p.vendorId === vendorId);
    if (params?.status) items = items.filter((p) => p.status === params.status);
    if (params?.q) {
      const query = params.q.toLowerCase();
      items = items.filter((p) => p.title.toLowerCase().includes(query));
    }
    return items
      .slice()
      .sort((a, b) => b.id.localeCompare(a.id))
      .map(withImages);
  }

  async getVendorProduct(vendorId: string, id: string): Promise<VendorProductDetail | null> {
    const product = seedProducts.find((p) => p.id === id);
    if (!product || product.vendorId !== vendorId) return null;
    return toDetail(product);
  }

  async createVendorProduct(
    vendorId: string,
    input: VendorProductInput,
    status: VendorProductStatus,
    slug: string,
  ): Promise<VendorProductDetail> {
    const product: ProductDTO = {
      id: `p-${crypto.randomUUID().slice(0, 8)}`,
      vendorId,
      categoryId: input.categoryId,
      title: input.title,
      slug,
      description: input.description,
      price: input.price,
      compareAtPrice: input.compareAtPrice ?? null,
      stock: input.stock,
      status,
      organic: input.organic,
      glutenFree: input.glutenFree,
      local: input.local,
      rating: 0,
    };
    seedProducts.push(product);
    setProductImages(product.id, input.images);
    memoryAttributes.set(product.id, { tags: input.tags, originNote: input.originNote ?? null });
    return toDetail(product);
  }

  async updateVendorProduct(
    vendorId: string,
    id: string,
    input: VendorProductInput,
  ): Promise<VendorProductDetail | null> {
    const product = seedProducts.find((p) => p.id === id);
    if (!product || product.vendorId !== vendorId) return null;
    Object.assign(product, {
      categoryId: input.categoryId,
      title: input.title,
      description: input.description,
      price: input.price,
      compareAtPrice: input.compareAtPrice ?? null,
      stock: input.stock,
      organic: input.organic,
      glutenFree: input.glutenFree,
      local: input.local,
    });
    setProductImages(product.id, input.images);
    memoryAttributes.set(product.id, { tags: input.tags, originNote: input.originNote ?? null });
    return toDetail(product);
  }

  async setVendorProductStatus(
    vendorId: string,
    id: string,
    status: VendorProductStatus,
  ): Promise<VendorProductDetail | null> {
    const product = seedProducts.find((p) => p.id === id);
    if (!product || product.vendorId !== vendorId) return null;
    product.status = status;
    return toDetail(product);
  }

  async listAllProducts(params?: VendorProductListParams): Promise<ProductDTO[]> {
    let items = [...seedProducts];
    if (params?.status) items = items.filter((p) => p.status === params.status);
    if (params?.q) {
      const query = params.q.toLowerCase();
      items = items.filter((p) => p.title.toLowerCase().includes(query));
    }
    return items.sort((a, b) => b.id.localeCompare(a.id)).map(withImages);
  }

  async setProductStatusAsAdmin(
    id: string,
    status: VendorProductStatus,
  ): Promise<VendorProductDetail | null> {
    const product = seedProducts.find((p) => p.id === id);
    if (!product) return null;
    product.status = status;
    return toDetail(product);
  }

  async getVendorProfileByUserId(userId: string): Promise<VendorProfileDTO | null> {
    for (const profile of this.profiles.values()) {
      if (profile.userId === userId) return { ...profile };
    }
    const seed = seedVendors.find((v) => (v.id === "v01" ? "u-vendor" : `seed-${v.id}`) === userId);
    return seed ? seedProfileToDTO(seed, userId) : null;
  }

  async getVendorProfileById(vendorId: string): Promise<VendorProfileDTO | null> {
    const profile = this.getProfile(vendorId);
    return profile ? { ...profile } : null;
  }

  async getVendorProfileBySlug(slug: string): Promise<VendorProfileDTO | null> {
    for (const profile of this.profiles.values()) {
      if (profile.slug === slug) return { ...profile };
    }
    const seed = seedVendors.find((v) => v.slug === slug);
    return seed ? seedProfileToDTO(seed, seed.id === "v01" ? "u-vendor" : `seed-${seed.id}`) : null;
  }

  async updateVendorProfile(vendorId: string, input: VendorProfileUpdate): Promise<VendorProfileDTO> {
    const current = this.getProfile(vendorId);
    if (!current) throw new Error(`Unknown vendor: ${vendorId}`);
    const next: VendorProfileDTO = {
      ...current,
      shopName: input.shopName,
      city: input.city,
      bio: input.bio ?? null,
      phone: input.phone ?? null,
      logoUrl: input.logoUrl || null,
      payoutIban: input.payoutIban ?? null,
      payoutAccountHolder: input.payoutAccountHolder ?? null,
    };
    this.putProfile(next);
    return { ...next };
  }

  async createVendorProfile(
    userId: string,
    input: { shopName: string; slug: string; city: string; bio?: string },
  ): Promise<VendorProfileDTO> {
    const profile: VendorProfileDTO = {
      id: `v-${crypto.randomUUID().slice(0, 8)}`,
      userId,
      shopName: input.shopName,
      slug: input.slug,
      city: input.city,
      bio: input.bio ?? null,
      status: "PENDING",
      rejectionReason: null,
      rating: 0,
      phone: null,
      logoUrl: null,
      payoutIban: null,
      payoutAccountHolder: null,
    };
    this.putProfile(profile);
    return { ...profile };
  }

  async setVendorProfileStatus(
    vendorId: string,
    status: "APPROVED" | "REJECTED",
    rejectionReason?: string | null,
  ): Promise<VendorProfileDTO | null> {
    const current = this.getProfile(vendorId);
    if (!current) return null;
    const next: VendorProfileDTO = {
      ...current,
      status,
      rejectionReason: status === "REJECTED" ? (rejectionReason ?? null) : null,
    };
    this.putProfile(next);
    return { ...next };
  }

  async listPendingVendorProfiles(): Promise<VendorProfileDTO[]> {
    return [...this.profiles.values()]
      .filter((p) => p.status === "PENDING")
      .map((p) => ({ ...p }));
  }
}

// ---------------------------------------------------------------------------
// Prisma adapter (real database — DATABASE_URL set)
// ---------------------------------------------------------------------------

type PrismaProductWithImages = PrismaProduct & { images: PrismaProductImage[] };

function attributesOf(p: PrismaProduct): { tags: string[]; originNote: string | null } {
  const raw = p.attributes as { tags?: unknown; originNote?: unknown } | null;
  return {
    tags: Array.isArray(raw?.tags)
      ? raw.tags.filter((t): t is string => typeof t === "string")
      : [],
    originNote: typeof raw?.originNote === "string" ? raw.originNote : null,
  };
}

function toProductDTO(p: PrismaProductWithImages): ProductDTO {
  return {
    id: p.id,
    vendorId: p.vendorId,
    categoryId: p.categoryId,
    title: p.title,
    slug: p.slug,
    description: p.description,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    stock: p.stock,
    status: p.status,
    organic: p.organic,
    glutenFree: p.glutenFree,
    local: p.local,
    rating: p.rating,
    images: p.images.map((i) => i.url),
  };
}

function toProductDetail(p: PrismaProductWithImages): VendorProductDetail {
  return { ...toProductDTO(p), ...attributesOf(p) };
}

function toProfileDTO(v: PrismaVendorProfile): VendorProfileDTO {
  return {
    id: v.id,
    userId: v.userId,
    shopName: v.shopName,
    slug: v.slug,
    city: v.city,
    bio: v.bio,
    status: v.status,
    rejectionReason: v.rejectionReason,
    rating: v.rating,
    phone: v.phone,
    logoUrl: v.logoUrl,
    payoutIban: v.payoutIban,
    payoutAccountHolder: v.payoutAccountHolder,
  };
}

const productWithImages = { images: { orderBy: { sortOrder: "asc" } } } as const;

export class PrismaVendorRepository implements VendorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listVendorProducts(vendorId: string, params?: VendorProductListParams): Promise<ProductDTO[]> {
    const items = await this.prisma.product.findMany({
      where: {
        vendorId,
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.q ? { title: { contains: params.q, mode: "insensitive" } } : {}),
      },
      include: productWithImages,
      orderBy: { createdAt: "desc" },
    });
    return items.map(toProductDTO);
  }

  async getVendorProduct(vendorId: string, id: string): Promise<VendorProductDetail | null> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productWithImages,
    });
    if (!product || product.vendorId !== vendorId) return null;
    return toProductDetail(product);
  }

  async createVendorProduct(
    vendorId: string,
    input: VendorProductInput,
    status: VendorProductStatus,
    slug: string,
  ): Promise<VendorProductDetail> {
    const product = await this.prisma.product.create({
      data: {
        vendorId,
        categoryId: input.categoryId,
        title: input.title,
        slug,
        description: input.description,
        price: input.price,
        compareAtPrice: input.compareAtPrice ?? null,
        stock: input.stock,
        status,
        organic: input.organic,
        glutenFree: input.glutenFree,
        local: input.local,
        attributes: { tags: input.tags, originNote: input.originNote ?? null },
        images: {
          create: input.images.map((image, index) => ({
            url: image.url,
            alt: image.alt || input.title,
            sortOrder: index,
          })),
        },
      },
      include: productWithImages,
    });
    return toProductDetail(product);
  }

  async updateVendorProduct(
    vendorId: string,
    id: string,
    input: VendorProductInput,
  ): Promise<VendorProductDetail | null> {
    const existing = await this.prisma.product.findUnique({ where: { id }, select: { vendorId: true } });
    if (!existing || existing.vendorId !== vendorId) return null;
    const product = await this.prisma.$transaction(async (tx) => {
      await tx.productImage.deleteMany({ where: { productId: id } });
      return tx.product.update({
        where: { id },
        data: {
          categoryId: input.categoryId,
          title: input.title,
          description: input.description,
          price: input.price,
          compareAtPrice: input.compareAtPrice ?? null,
          stock: input.stock,
          organic: input.organic,
          glutenFree: input.glutenFree,
          local: input.local,
          attributes: { tags: input.tags, originNote: input.originNote ?? null },
          images: {
            create: input.images.map((image, index) => ({
              url: image.url,
              alt: image.alt || input.title,
              sortOrder: index,
            })),
          },
        },
        include: productWithImages,
      });
    });
    return toProductDetail(product);
  }

  async setVendorProductStatus(
    vendorId: string,
    id: string,
    status: VendorProductStatus,
  ): Promise<VendorProductDetail | null> {
    const existing = await this.prisma.product.findUnique({ where: { id }, select: { vendorId: true } });
    if (!existing || existing.vendorId !== vendorId) return null;
    const product = await this.prisma.product.update({
      where: { id },
      data: { status },
      include: productWithImages,
    });
    return toProductDetail(product);
  }

  async listAllProducts(params?: VendorProductListParams): Promise<ProductDTO[]> {
    const items = await this.prisma.product.findMany({
      where: {
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.q ? { title: { contains: params.q, mode: "insensitive" } } : {}),
      },
      include: productWithImages,
      orderBy: { createdAt: "desc" },
    });
    return items.map(toProductDTO);
  }

  async setProductStatusAsAdmin(
    id: string,
    status: VendorProductStatus,
  ): Promise<VendorProductDetail | null> {
    const existing = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return null;
    const product = await this.prisma.product.update({
      where: { id },
      data: { status },
      include: productWithImages,
    });
    return toProductDetail(product);
  }

  async getVendorProfileByUserId(userId: string): Promise<VendorProfileDTO | null> {
    const profile = await this.prisma.vendorProfile.findUnique({ where: { userId } });
    return profile ? toProfileDTO(profile) : null;
  }

  async getVendorProfileById(vendorId: string): Promise<VendorProfileDTO | null> {
    const profile = await this.prisma.vendorProfile.findUnique({ where: { id: vendorId } });
    return profile ? toProfileDTO(profile) : null;
  }

  async getVendorProfileBySlug(slug: string): Promise<VendorProfileDTO | null> {
    const profile = await this.prisma.vendorProfile.findUnique({ where: { slug } });
    return profile ? toProfileDTO(profile) : null;
  }

  async updateVendorProfile(vendorId: string, input: VendorProfileUpdate): Promise<VendorProfileDTO> {
    const profile = await this.prisma.vendorProfile.update({
      where: { id: vendorId },
      data: {
        shopName: input.shopName,
        city: input.city,
        bio: input.bio ?? null,
        phone: input.phone ?? null,
        logoUrl: input.logoUrl || null,
        payoutIban: input.payoutIban ?? null,
        payoutAccountHolder: input.payoutAccountHolder ?? null,
      },
    });
    return toProfileDTO(profile);
  }

  async createVendorProfile(
    userId: string,
    input: { shopName: string; slug: string; city: string; bio?: string },
  ): Promise<VendorProfileDTO> {
    const profile = await this.prisma.vendorProfile.create({
      data: {
        userId,
        shopName: input.shopName,
        slug: input.slug,
        city: input.city,
        bio: input.bio ?? null,
        status: "PENDING",
      },
    });
    return toProfileDTO(profile);
  }

  async listPendingVendorProfiles(): Promise<VendorProfileDTO[]> {
    const profiles = await this.prisma.vendorProfile.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });
    return profiles.map(toProfileDTO);
  }

  async setVendorProfileStatus(
    vendorId: string,
    status: "APPROVED" | "REJECTED",
    rejectionReason?: string | null,
  ): Promise<VendorProfileDTO | null> {
    const profile = await this.prisma.vendorProfile
      .update({
        where: { id: vendorId },
        data: {
          status,
          rejectionReason: status === "REJECTED" ? (rejectionReason ?? null) : null,
        },
      })
      .catch(() => null);
    return profile ? toProfileDTO(profile) : null;
  }
}

// ---------------------------------------------------------------------------
// Factory — the only entry point the app uses
// ---------------------------------------------------------------------------

const globalForVendorRepo = globalThis as unknown as { vendorRepo?: VendorRepository };

/** Prisma when DATABASE_URL is set, otherwise the seed/memory adapter. */
export function getVendorRepository(): VendorRepository {
  const prisma = getPrismaClient();
  if (prisma) return new PrismaVendorRepository(prisma);
  globalForVendorRepo.vendorRepo ??= new MemoryVendorRepository();
  return globalForVendorRepo.vendorRepo;
}

/** Which adapter is active — shown in README/docs, never a secret. */
export function getVendorDataSource(): "prisma" | "memory" {
  return getPrismaClient() ? "prisma" : "memory";
}
