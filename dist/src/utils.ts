import { ILogger } from "@spt/models/spt/utils/ILogger";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { IItemConfig } from "@spt/models/spt/config/IItemConfig";
import { IPmcConfig } from "@spt/models/spt/config/IPmcConfig";

import { containerLookup, traderLookup, totalRelativeProbability } from "./constants";

export function removeFromRewardPool(
    itemId: string,
    itemConfig : IItemConfig,
    logger: ILogger
): void {
    
    if (!itemConfig.rewardItemBlacklist.includes(itemId)) {
        itemConfig.rewardItemBlacklist.push(itemId);
    }
}

export function removeFromPMCLootPool(
    itemId: string,
    PMCConfig : IPmcConfig,
    logger: ILogger
): void {
    if (!PMCConfig.globalLootBlacklist.includes(itemId)) {
        PMCConfig.globalLootBlacklist.push(itemId);
    }
}

export function addtoStaticLoot(
    itemId: string,
    staticLootData: Record<string, Record<string, number>>,
    database: ReturnType<DatabaseServer["getTables"]>,
    logger: ILogger
): void {
    // Loop through all maps in staticLootInfo
    for (const mapName of Object.keys(staticLootData)) {
        const mapLoot = staticLootData[mapName];
        const location = database.locations[mapName];

        if (!location) continue;

        // Loop through containers for this map
        for (const containerName of Object.keys(mapLoot)) {
            const containerID = containerLookup[containerName];
            if (!containerID) {
                logger.warning(`Container ${containerName} not found in containerLookup`);
                continue;
            }

            const lootContainer = location.staticLoot[containerID];
            if (!lootContainer) {
                logger.warning(`Container ID ${containerID} not found in map ${mapName}`);
                continue;
            }

            const totalProbability = totalRelativeProbability[mapName][containerName]

            if (totalProbability === undefined) {
                logger.warning(`TotalRelativeProbability not found for Container ID ${containerID} in map ${mapName}`);
            } else {
                // Convert spawnProbability (float) to relativeProbability (int)
                const spawnProbability = mapLoot[containerName]
                if (spawnProbability >= 1) {
                    logger.warning(`Skipping item ${itemId} for container ${containerName} in map ${mapName} because relativeProbability=${spawnProbability} >= 1`);
                    continue;
                }

                const relativeProbability = Math.round((spawnProbability * totalProbability) / (1 - spawnProbability));
                if (relativeProbability <= 0) {
                    continue;
                }

                const newLoot = [
                    {
                        tpl: itemId,
                        relativeProbability: relativeProbability
                    }
                ];

                lootContainer.itemDistribution.push(...newLoot);
            }
        }
    }
}

export function addtoHallofFame(
    itemId: string,
    itemSize: string,
    database: ReturnType<DatabaseServer["getTables"]>,
    logger: ILogger
): void {
    const hallofFame1 = database.templates.items["63dbd45917fff4dee40fe16e"];
    const hallofFame2 = database.templates.items["65424185a57eea37ed6562e9"];
    const hallofFame3 = database.templates.items["6542435ea57eea37ed6562f0"];

    const hallOfFames = [hallofFame1, hallofFame2, hallofFame3];
    for (const hall of hallOfFames) {
        for (const slot of hall._props.Slots) {
            if (slot._name.startsWith(itemSize)) {
                for (const filter of slot._props.filters) {
                    if (!filter.Filter.includes(itemId)) {
                        filter.Filter.push(itemId);
                    }
                }
            }
        }
    }
}

export function addtoTraderTrades(
    itemId: string,
    traderTradesData: Record<string, boolean>,
    database: ReturnType<DatabaseServer["getTables"]>,
    logger: ILogger
): void {
    for (const [trader, tradeAllowed] of Object.entries(traderTradesData)) {
        const traderId = traderLookup[trader]
        const traderBase = database.traders[traderId].base
        if (tradeAllowed) {
            if (!traderBase["items_buy"]["id_list"].includes(itemId)) {
                traderBase["items_buy"]["id_list"].push(itemId);
            }
        }
        else {
            if (!traderBase["items_buy_prohibited"]["id_list"].includes(itemId)) {
                traderBase["items_buy_prohibited"]["id_list"].push(itemId);
            }
        }
    }
}