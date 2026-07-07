import { Module } from "@nestjs/common";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";
import { QuotationsController } from "./quotations.controller";
import { QuotationsService } from "./quotations.service";

@Module({
  controllers: [QuotationsController, CustomersController],
  providers: [QuotationsService, CustomersService],
})
export class QuotationsModule {}
