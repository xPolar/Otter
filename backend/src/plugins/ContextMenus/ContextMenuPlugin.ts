import { PluginOptions } from "knub";
import { GuildCases } from "../../data/GuildCases";
import { makeIoTsConfigParser } from "../../pluginUtils";
import { trimPluginDescription } from "../../utils";
import { CasesPlugin } from "../Cases/CasesPlugin";
import { LogsPlugin } from "../Logs/LogsPlugin";
import { MutesPlugin } from "../Mutes/MutesPlugin";
import { UtilityPlugin } from "../Utility/UtilityPlugin";
import { zeppelinGuildPlugin } from "../ZeppelinPluginBlueprint";
import { ModMenuCmd } from "./commands/ModMenuCmd";
import { ConfigSchema, ContextMenuPluginType } from "./types";

const defaultOptions: PluginOptions<ContextMenuPluginType> = {
  config: {
    can_use: false,

    can_open_mod_menu: false,

    log_channel: null,
  },
  overrides: [
    {
      level: ">=50",
      config: {
        can_use: true,

        can_open_mod_menu: true,
      },
    },
  ],
};

export const ContextMenuPlugin = zeppelinGuildPlugin<ContextMenuPluginType>()({
  name: "context_menu",
  showInDocs: true,
  info: {
    prettyName: "Context Menus",
    description: trimPluginDescription(`
      This plugin provides command shortcuts via context menus
    `),
    configSchema: ConfigSchema,
  },

  dependencies: () => [CasesPlugin, MutesPlugin, LogsPlugin, UtilityPlugin],
  configParser: makeIoTsConfigParser(ConfigSchema),
  defaultOptions,

  contextMenuCommands: [ModMenuCmd],

  beforeLoad(pluginData) {
    const { state, guild } = pluginData;

    state.cases = GuildCases.getGuildInstance(guild.id);
  },
});
