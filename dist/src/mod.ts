import fs from "node:fs";
import path from "node:path";
import { DependencyContainer } from "tsyringe";
import { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import { CustomItemService } from "@spt/services/mod/CustomItemService";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { ConfigServer } from "@spt/servers/ConfigServer";

import { DogeItemService } from "./utils";

class TarkovCollectibles implements IPostDBLoadMod
{
    public postDBLoad(container: DependencyContainer): void
    {
        const logger = container.resolve<ILogger>("WinstonLogger");
        const customItemService = container.resolve<CustomItemService>("CustomItemService");
        const databaseServer = container.resolve<DatabaseServer>("DatabaseServer");
        const database = databaseServer.getTables();
        const configServer = container.resolve<ConfigServer>("ConfigServer");
        const configFilePath = path.resolve(__dirname, "../config/config.json");
        const config = JSON.parse(fs.readFileSync(configFilePath, "utf-8"));
        const itemIdLookupFilePath = path.resolve(__dirname, "../db/Items/itemIdLookup.json");
        const itemIdLookup: Record<string, string> = JSON.parse(fs.readFileSync(itemIdLookupFilePath, "utf-8"));
        const itemDataFilePath = path.resolve(__dirname, "../db/Items/itemData.json");
        const itemData: Record<string, any> = JSON.parse(fs.readFileSync(itemDataFilePath, "utf-8"));
        const staticLootDataFilePath = path.resolve(__dirname, "../db/Items/staticLootData.json");
        const staticLootData: Record<string, any> = JSON.parse(fs.readFileSync(staticLootDataFilePath, "utf-8"));
        const looseLootDataFilePath = path.resolve(__dirname, "../db/Items/looseLootData.json");
        const looseLootData: Record<string, any> = JSON.parse(fs.readFileSync(looseLootDataFilePath, "utf-8"));
        const hallofFameDataFilePath = path.resolve(__dirname, "../db/Items/hallofFameData.json");
        const hallofFameData: Record<string, any> = JSON.parse(fs.readFileSync(hallofFameDataFilePath, "utf-8"));
        const traderDataFilePath = path.resolve(__dirname, "../db/Items/traderData.json");
        const traderData: Record<string, any> = JSON.parse(fs.readFileSync(traderDataFilePath, "utf-8"));

        logger.info("[Tarkov Rare Collectibles] Start loading items");

        const itemService = new DogeItemService(logger, database, configServer);

        for (const itemId of Object.keys(itemIdLookup)) {
            customItemService.createItemFromClone(itemData[itemId]);
            itemService.addtoStaticLoot(itemId, staticLootData[itemId], config["staticLootMultiplier"]);
            itemService.addtoLooseLoot(itemId, looseLootData[itemId], config["looseLootMultiplier"])
            itemService.addtoTraderTrades(itemId, traderData[itemId]);
            itemService.addtoHallofFame(itemId, hallofFameData[itemId]);
            itemService.removeFromRewardPool(itemId);
            itemService.removeFromPMCLootPool(itemId);
        }

        logger.info("[Tarkov Rare Collectibles] Finished loading items");

    }
}

export const mod = new TarkovCollectibles();