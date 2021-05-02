# MinoTorrentBot

MinoTorrentBot is a discord bot that aims at managing torrent downloads
requested by its users.

## Feature list

MinoTorrentBot is currently able to do the following:

- Receive a download request from an user and start downloading the torrent.
- Admin-configured regex-based substitutions on URIs.
- Keep the users updated on the torrent's download state through
  a regularly updated embed that informs the user of the torrent's progress,
  and with the HTTP(s)/FTP/other link the user.
- Register a reminder that will be sent at the provided time to the wanted
  users or groups.
- Save pending downloads and reminders so it could be resumed after a
  restart of the bot.


## Configuration

Configurations shown here, except when stated otherwise, are done in the
`config.json` file.

### Discord token

The discord token is retrieved through the `DISCORD_TOKEN` environment
variable. The dotenv package is installed, the token could thus be stored
in the `.env` file.

### Directory management

The `local_directory` attribute of the configuration stores the URI
of the directory in which torrents should be stored on the local machine.
Each torrent will have its own directory in there.

The `remote_directory` attribute stores an URI that allows users to
access `local_directory`. This URI will be used when creating the links
given to the users after download completes.

### Torrent URI substitutions

In order to allow short links, a substitution system is available through
the `substitution` attribute of the configuration JSON. It stores an array
of objects with the `src` ans `dst` attributes. `src` should be a valid
regular expression, and `dst` the string to replace it by. Groups defined
in the `src` regular expression could be references by using `$n` with `n`
being the index (1-indexed) of the group:

```JSON
{"src": "^([0-9]+)$", "dst": "https://site/$1.torrent"}
```

## Usage

### General command syntax

The bot reacts to pings done to role `MinoTorrentBot`, or to the bot
directly.

The parsing is done as follow:

- The bot's mentions are removed
- The message is split in lines. Each line represents one download.
- Lines are split in words, using spaces as separators. A word could
  contain spaces by enclosing it in quotes: `"single word"`.
- The first word of the line is the URL of the torrent.
- All other words will be given to the command parser:
  - The first word is the command name.
  - The provided command's parser parses its argument, then give back
    the index of the last read argument.
  - If arguments remain, go back to step 1 of the command parser.

Example:

```
@bot_name URL1 cmd  arg_1   arg_2
          URL2 cmd "arg 1" "arg 2"
```

### Commands

#### Remind

The remind command allows an user to set a reminder in the future.
When this point in time is reached or the download finishes, whichever
comes last, a message will be posted, with mentions the user provided to
allow pinging users or roles.

Usage: `remind "date" "mention_1 mention_2"`

Mentions could be one of the following:
- The discord ID of a role or user, or a part of one.
- The display name of a role or of an user (with spaces replaced by
  underscores).
- An user's nickname (`azer#0012`).

Note that mentions should not be prepended by `@`, in order not to pollute
the users' feed when registering the command.