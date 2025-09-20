import fs from "node:fs";
import path from "node:path";
import { DependencyContainer } from "tsyringe";
import { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import { CustomItemService } from "@spt/services/mod/CustomItemService";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { ConfigServer } from "@spt/servers/ConfigServer";
import { ConfigTypes } from "@spt/models/enums/ConfigTypes";
import { IItemConfig } from "@spt/models/spt/config/IItemConfig";
import { IPmcConfig } from "@spt/models/spt/config/IPmcConfig";

import { removeFromRewardPool, removeFromPMCLootPool, addtoStaticLoot, addtoHallofFame, addtoTraderTrades } from "./utils";

class TarkovCollectibles implements IPostDBLoadMod
{
    public postDBLoad(container: DependencyContainer): void
    {
        const logger = container.resolve<ILogger>("WinstonLogger");
        const customItem = container.resolve<CustomItemService>("CustomItemService");
        const databaseServer = container.resolve<DatabaseServer>("DatabaseServer");
        const database = databaseServer.getTables();
        const configServer = container.resolve<ConfigServer>("ConfigServer");
        const itemConfig : IItemConfig = configServer.getConfig(ConfigTypes.ITEM);
        const PMCConfig : IPmcConfig = configServer.getConfig(ConfigTypes.PMC);
        const itemIdLookupFilePath = path.resolve(__dirname, "../db/Items/itemIdLookup.json");
        const itemIdLookup: Record<string, string> = JSON.parse(fs.readFileSync(itemIdLookupFilePath, "utf-8"));
        const itemDataFilePath = path.resolve(__dirname, "../db/Items/itemData.json");
        const itemData: Record<string, any> = JSON.parse(fs.readFileSync(itemDataFilePath, "utf-8"));
        const staticLootDataFilePath = path.resolve(__dirname, "../db/Items/staticLootData.json");
        const staticLootData: Record<string, any> = JSON.parse(fs.readFileSync(staticLootDataFilePath, "utf-8"));
        const hallofFameDataFilePath = path.resolve(__dirname, "../db/Items/hallofFameData.json");
        const hallofFameData: Record<string, any> = JSON.parse(fs.readFileSync(hallofFameDataFilePath, "utf-8"));
        const traderDataFilePath = path.resolve(__dirname, "../db/Items/traderData.json");
        const traderData: Record<string, any> = JSON.parse(fs.readFileSync(traderDataFilePath, "utf-8"));

        logger.info("[Tarkov Rare Collectibles] Start loading items");

        for (const itemId of Object.keys(itemIdLookup)) {
            customItem.createItem(itemData[itemId]);
            removeFromRewardPool(itemId, itemConfig, logger)
            removeFromPMCLootPool(itemId, PMCConfig, logger)
            addtoStaticLoot(itemId, staticLootData[itemId], database, logger);
            addtoTraderTrades(itemId, traderData[itemId], database, logger);
            if (hallofFameData[itemId]["addtoHallofFame"]) {
                addtoHallofFame(itemId, hallofFameData[itemId]["itemSize"], database, logger);
            }
        }

        logger.info("[Tarkov Rare Collectibles] Finished loading items");

    }
}

export const mod = new TarkovCollectibles();