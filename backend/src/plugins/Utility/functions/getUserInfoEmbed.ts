import { APIEmbed } from "discord.js";
import { GuildPluginData } from "knub";
import moment from "moment-timezone";
import { CaseTypes } from "../../../data/CaseTypes";
import {
  EmbedWith,
  messageLink,
  preEmbedPadding,
  renderUsername,
  resolveMember,
  resolveUser,
  sorter,
  trimEmptyLines,
  trimLines,
  UnknownUser,
} from "../../../utils";
import { TimeAndDatePlugin } from "../../TimeAndDate/TimeAndDatePlugin";
import { UtilityPluginType } from "../types";

const MAX_ROLES_TO_DISPLAY = 15;

const trimRoles = (roles: string[]) =>
  roles.length > MAX_ROLES_TO_DISPLAY
    ? roles.slice(0, MAX_ROLES_TO_DISPLAY).join(", ") + `, and ${roles.length - MAX_ROLES_TO_DISPLAY} more roles`
    : roles.join(", ");

export async function getUserInfoEmbed(
  pluginData: GuildPluginData<UtilityPluginType>,
  userId: string,
  compact = false,
  requestMemberId?: string,
): Promise<APIEmbed | null> {
  const user = await resolveUser(pluginData.client, userId);
  if (!user || user instanceof UnknownUser) {
    return null;
  }

  const member = await resolveMember(pluginData.client, pluginData.guild, user.id);

  const timeAndDate = pluginData.getPlugin(TimeAndDatePlugin);
  const embed: EmbedWith<"fields"> = {
    fields: [],
  };

  embed.author = {
    name: `${user.bot ? "Bot" : "User"}:  ${renderUsername(user)}`,
  };

  const createdAt = moment.utc(user.createdAt, "x");
  const tzCreatedAt = requestMemberId
    ? await timeAndDate.inMemberTz(requestMemberId, createdAt)
    : timeAndDate.inGuildTz(createdAt);
  const prettyCreatedAt = tzCreatedAt.format(timeAndDate.getDateFormat("pretty_datetime"));
  let prettyJoinedAt = "";

  if (member) {
    const joinedAt = moment.utc(member.joinedTimestamp!, "x");
    const tzJoinedAt = requestMemberId
      ? await timeAndDate.inMemberTz(requestMemberId, joinedAt)
      : timeAndDate.inGuildTz(joinedAt);

    prettyJoinedAt = tzJoinedAt.format(timeAndDate.getDateFormat("pretty_datetime"));
  }

  embed.author.icon_url = (member ?? user).displayAvatarURL();

  if (compact) {
    embed.fields.push({
      name: preEmbedPadding + `${user.bot ? "Bot" : "User"} information`,
      value: trimLines(`
          Profile: <@!${user.id}>
          Created: **<t:${Math.round(user.createdTimestamp / 1000)}:R>** (\`${prettyCreatedAt}\`)
          `),
    });
    if (member) {
      embed.fields[0].value += `\n${user.bot ? "Added" : "Joined"}: **<t:${Math.round(
        member.joinedTimestamp! / 1000,
      )}:R>** (\`${prettyJoinedAt}\`)`;
    } else {
      embed.fields.push({
        name: preEmbedPadding + "!! NOTE !!",
        value: `${user.bot ? "Bot" : "User"} is not on the server`,
      });
    }

    return embed;
  }

  const config = pluginData.config.get();
  const userInfoLines = [`ID: \`${user.id}\`\n`, `Username: **${user.username}**`];

  if (user.discriminator !== "0") userInfoLines.push(`Discriminator: **${user.discriminator}**`);
  if (user.globalName) userInfoLines.push(`Display Name: **${user.globalName}**`);
  if (member) userInfoLines.push(`Server Nickname: **${member.nickname ?? "*no nickname defined*"}**`);
  userInfoLines.push(`Mention: <@!${user.id}>\n`);

  userInfoLines.push(
    `${config.emojis.account_created} Created: **<t:${Math.round(
      user.createdTimestamp / 1000,
    )}:R>** (\`${prettyCreatedAt}\`)`,
  );

  if (member) {
    const roles = Array.from(member.roles.cache.values()).filter((r) => r.id !== pluginData.guild.id);
    roles.sort(sorter("position", "DESC"));

    userInfoLines.push(
      `${config.emojis.member_joined} ${user.bot ? "Added" : "Joined"}: **<t:${Math.round(
        member.joinedTimestamp! / 1000,
      )}:R>** (\`${prettyJoinedAt}\`)`,
    );

    userInfoLines.push(`\n${roles.length > 0 ? "Roles: " + trimRoles(roles.map((r) => `<@&${r.id}>`)) : ""}`);
  }

  embed.fields.push({
    name: preEmbedPadding + `${user.bot ? "Bot" : "User"} information`,
    value: userInfoLines.join("\n"),
  });

  const voiceChannel = member?.voice.channelId ? pluginData.guild.channels.cache.get(member.voice.channelId) : null;

  if (member && (voiceChannel || member.voice.mute || member.voice.deaf)) {
    embed.fields.push({
      name: preEmbedPadding + "Voice information",
      value: trimEmptyLines(`
        ${voiceChannel ? `Current voice channel: **${voiceChannel.name ?? "None"}**` : ""}
        ${member.voice.serverMute ? "Server-muted: **Yes**" : ""}
        ${member.voice.serverDeaf ? "Server-deafened: **Yes**" : ""}
        ${member.voice.selfMute ? "Self-muted: **Yes**" : ""}
        ${member.voice.selfDeaf ? "Self-deafened: **Yes**" : ""}
      `),
    });
  }

  if (!member) {
    embed.fields.push({
      name: preEmbedPadding + "Member information",
      value: `⚠ ${user.bot ? "Bot" : "User"} is not on the server`,
    });
  }

  const cases = (await pluginData.state.cases.getByUserId(user.id)).filter((c) => !c.is_hidden);

  if (cases.length > 0) {
    cases.sort((a, b) => {
      return a.created_at < b.created_at ? 1 : -1;
    });

    const caseSummary = cases.slice(0, 3).map((c) => {
      const summaryText = `${CaseTypes[c.type]} (#${c.case_number})`;

      if (c.log_message_id) {
        const [channelId, messageId] = c.log_message_id.split("-");
        return `[${summaryText}](${messageLink(pluginData.guild.id, channelId, messageId)})`;
      }

      return summaryText;
    });

    const summaryLabel = cases.length > 3 ? "Last 3 cases" : "Summary";

    embed.fields.push({
      name: preEmbedPadding + "Cases",
      value: trimLines(`
          Total cases: **${cases.length}**
          ${summaryLabel}: ${caseSummary.join(", ")}
        `),
    });
  }

  return embed;
}
