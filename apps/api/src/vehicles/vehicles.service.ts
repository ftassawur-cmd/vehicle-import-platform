import { Injectable, NotFoundException } from "@nestjs/common";
import { FuelType, Prisma, VehicleClass } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  listMakes(withModels: boolean) {
    return this.prisma.vehicleMake.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: withModels
        ? { models: { orderBy: [{ popular: "desc" }, { name: "asc" }], select: { id: true, name: true, class: true, popular: true } } }
        : undefined,
    });
  }

  listModels(makeId: string) {
    return this.prisma.vehicleModel.findMany({
      where: { makeId },
      orderBy: [{ popular: "desc" }, { name: "asc" }],
      include: { _count: { select: { variants: true } } },
    });
  }

  async searchVariants(opts: {
    q?: string;
    makeId?: string;
    modelId?: string;
    fuelType?: FuelType;
    vehicleClass?: VehicleClass;
    take?: number;
    skip?: number;
  }) {
    const take = Math.min(Math.max(opts.take ?? 30, 1), 100);
    const skip = Math.max(opts.skip ?? 0, 0);
    const where: Prisma.VehicleVariantWhereInput = {
      ...(opts.modelId ? { modelId: opts.modelId } : {}),
      ...(opts.makeId ? { model: { makeId: opts.makeId } } : {}),
      ...(opts.fuelType ? { fuelType: opts.fuelType } : {}),
      ...(opts.vehicleClass ? { model: { ...(opts.makeId ? { makeId: opts.makeId } : {}), class: opts.vehicleClass } } : {}),
      ...(opts.q
        ? {
            OR: [
              { code: { contains: opts.q, mode: "insensitive" } },
              { model: { name: { contains: opts.q, mode: "insensitive" } } },
              { model: { make: { name: { contains: opts.q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vehicleVariant.findMany({
        where,
        orderBy: [{ model: { popular: "desc" } }, { yearFrom: "desc" }],
        take,
        skip,
        include: {
          model: { select: { id: true, name: true, class: true, make: { select: { id: true, name: true } } } },
          images: { where: { kind: "hero" }, take: 1, orderBy: { sortOrder: "asc" } },
        },
      }),
      this.prisma.vehicleVariant.count({ where }),
    ]);
    return { total, take, skip, items };
  }

  async getVariant(id: string) {
    const variant = await this.prisma.vehicleVariant.findUnique({
      where: { id },
      include: {
        model: { include: { make: true } },
        images: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] },
      },
    });
    if (!variant) throw new NotFoundException("Vehicle variant not found.");
    return variant;
  }

  /* ── Admin catalog CRUD ── */

  createMake(data: { name: string; country?: string; logoUrl?: string }) {
    return this.prisma.vehicleMake.create({ data });
  }

  createModel(data: { makeId: string; name: string; class?: VehicleClass; popular?: boolean }) {
    return this.prisma.vehicleModel.create({ data });
  }

  createVariant(data: Prisma.VehicleVariantUncheckedCreateInput) {
    return this.prisma.vehicleVariant.create({ data });
  }

  addImage(variantId: string, data: { url: string; kind?: string; sortOrder?: number; source?: string }) {
    return this.prisma.vehicleImage.create({ data: { variantId, ...data } });
  }
}
