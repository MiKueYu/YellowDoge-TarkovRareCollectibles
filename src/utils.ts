import { ILogger } from "@spt/models/spt/utils/ILogger";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { ConfigServer } from "@spt/servers/ConfigServer";
import { ConfigTypes } from "@spt/models/enums/ConfigTypes";
import { IItemConfig } from "@spt/models/spt/config/IItemConfig";
import { IPmcConfig } from "@spt/models/spt/config/IPmcConfig";

import { containerLookup, traderLookup, totalRelativeProbability, looseLootTemplate } from "./constants";

interface LootPosition { x: number; y: number; z: number; }

export class DogeItemService {
    private logger: ILogger;
    private database: ReturnType<DatabaseServer["getTables"]>;
    private configServer: ConfigServer;

    constructor(
        logger: ILogger,
        database: ReturnType<DatabaseServer["getTables"]>,
        configServer: ConfigServer
    ) {
        this.logger = logger;
        this.database = database;
        this.configServer = configServer;
    }

    public addtoStaticLoot(
        itemId: string,
        staticLootData: Record<string, Record<string, number>>,
        staticLootMultiplier: number
    ): void {
        // Loop through all maps in staticLootData
        for (const mapName of Object.keys(staticLootData)) {
            const mapLoot = staticLootData[mapName];
            const location = this.database.locations[mapName];

            if (!location) continue;

            // Loop through containers for this map
            for (const containerName of Object.keys(mapLoot)) {
                const containerID = containerLookup[containerName];
                if (!containerID) {
                    this.logger.warning(`Container ${containerName} not found in containerLookup`);
                    continue;
                }

                const lootContainer = location.staticLoot[containerID];
                if (!lootContainer) {
                    this.logger.warning(`Container ID ${containerID} not found in map ${mapName}`);
                    continue;
                }

                const totalProbability = totalRelativeProbability[mapName][containerName]

                if (totalProbability === undefined) {
                    this.logger.warning(`TotalRelativeProbability not found for Container ID ${containerID} in map ${mapName}`);
                } else {
                    // Convert spawnProbability (float) to relativeProbability (int)
                    let spawnProbability = mapLoot[containerName] * staticLootMultiplier;
                    if (spawnProbability >= 0.25) {
                        this.logger.warning(`Force spawnProbability=0.25 for item ${itemId} for container ${containerName} in map ${mapName} because spawnProbability=${spawnProbability} >= 0.25`);
                        spawnProbability = 0.25;
                    }

                    const relativeProbability = Math.round((spawnProbability * totalProbability) / (1 - spawnProbability));
                    if (relativeProbability <= 0) {
                        this.logger.warning(`Skipping item ${itemId} for container ${containerName} in map ${mapName} because relativeProbability=${relativeProbability} <= 0 | spawnProbability=${spawnProbability} | totalProbability=${totalProbability} | calculated relativeProbability before rounding: ${(spawnProbability * totalProbability) / (1 - spawnProbability)}`);
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

    private createLooseLootSpawn(
        itemId: string,
        spawnData: {
            Id: string;
            Position: LootPosition;
            probability: number;
        }
    ): any {
        const spawn = {
            ...looseLootTemplate,
            locationId: `(${spawnData.Position.x}, ${spawnData.Position.y}, ${spawnData.Position.z})`,
            probability: spawnData.probability,
            template: {
                ...looseLootTemplate.template,
                Id: spawnData.Id,
                Position: spawnData.Position,
                Items: looseLootTemplate.template.Items.map(item => ({
                    ...item,
                    _tpl: itemId
                }))
            }
        };
        return spawn;
    }

    public addtoLooseLoot(
        itemId: string,
        looseLootData: Record<string, any[]>,
        looseLootMultiplier: number
    ): void {
        // Loop through all maps in looseLootData
        for (const mapName of Object.keys(looseLootData)) {
            const mapLoot = looseLootData[mapName];
            const location = this.database.locations[mapName];

            if (!location) continue;

            // Loop through spawnData for this map
            for (const spawnData of mapLoot) {

                // Apply looseLootMultiplier
                let newRelativeProbability = spawnData["probability"] * looseLootMultiplier;

                if (newRelativeProbability > 5) {
                    this.logger.warning(`Force RelativeProbability=5 for item ${itemId} for loose loot spawn point ${spawnData.locationId} in map ${mapName}`);
                    newRelativeProbability = 5;
                }
                spawnData["probability"] = newRelativeProbability;
                const looseLootSpawn = this.createLooseLootSpawn(itemId, spawnData)

                location.looseLoot.spawnpoints.push(looseLootSpawn);
            }
        }
    }

    public addtoHallofFame(
        itemId: string,
        itemSize: string
    ): void {
        const hallofFame1 = this.database.templates.items["63dbd45917fff4dee40fe16e"];
        const hallofFame2 = this.database.templates.items["65424185a57eea37ed6562e9"];
        const hallofFame3 = this.database.templates.items["6542435ea57eea37ed6562f0"];

        const hallOfFames = [hallofFame1, hallofFame2, hallofFame3];

        if (itemSize) {
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
    }

    public addtoTraderTrades(
        itemId: string,
        traderTradesData: Record<string, boolean>
    ): void {
        for (const [trader, tradeAllowed] of Object.entries(traderTradesData)) {
            const traderId = traderLookup[trader]
            const traderBase = this.database.traders[traderId].base
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

    public removeFromRewardPool(
        itemId: string
    ): void {
        const itemConfig : IItemConfig = this.configServer.getConfig(ConfigTypes.ITEM);
        
        if (!itemConfig.rewardItemBlacklist.includes(itemId)) {
            itemConfig.rewardItemBlacklist.push(itemId);
        }
    }

    public removeFromPMCLootPool(
        itemId: string
    ): void {
        const PMCConfig : IPmcConfig = this.configServer.getConfig(ConfigTypes.PMC);

        if (!PMCConfig.globalLootBlacklist.includes(itemId)) {
            PMCConfig.globalLootBlacklist.push(itemId);
        }
    }

}