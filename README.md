# 🎬 doGior's SkyStream Plugins

Italian streaming, anime, live TV, and torrent plugins for [SkyStream](https://github.com/akashdh11/skystream).

> Ported from the original [doGiorsHadEnough](https://github.com/doGior/doGiorsHadEnough) CloudStream repository.

## 📦 Plugins

### 🎥 Movies & TV Series
| Plugin | Language | Source |
|:-------|:---------|:-------|
| **StreamingCommunity** | 🇮🇹 IT | streamingunity.biz |
| **AltaDefinizione** | 🇮🇹 IT | altadefinizionez.skin |
| **CB01** | 🇮🇹 IT | cb01uno.uno |
| **Nebula** | 🇬🇧 EN | nebula.tv |
| **OnlineSerieTV** | 🇮🇹 IT | onlineserietv.net |
| **Vavoo** | 🇮🇹 IT | vavoo.to |
| **Arte** | 🇮🇹 IT | arte.tv |

### 🎌 Anime
| Plugin | Language | Source |
|:-------|:---------|:-------|
| **AnimeUnity** | 🇮🇹 IT | animeunity.so |
| **AnimeWorld** | 🇮🇹 IT | animeworld.so |

### 📺 Live TV & Sports
| Plugin | Language | Source |
|:-------|:---------|:-------|
| **DaddyLive** | 🌐 Multi | dlhd.dad |
| **CalcioStreaming** | 🇮🇹 IT | calciostreaming.click |
| **Huhu** | 🇮🇹 IT | huhu.to |

### 🧲 Torrent
| Plugin | Language | Source |
|:-------|:---------|:-------|
| **Torrentio** | 🇬🇧 EN | torrentio.strem.fun |
| **CorsaroNero** | 🇮🇹 IT | ilcorsaronero.info |
| **IlCorsaroViola** | 🇮🇹 IT | ilcorsaroviola.me |

### 📹 Other
| Plugin | Language | Source |
|:-------|:---------|:-------|
| **YouTube** | 🌐 Multi | Invidious API |

## 🚀 Installation

### Via SkyStream App
1. Open SkyStream app
2. Go to **Settings** → **Plugins** → **Add Repository**
3. Enter the repository URL: `https://your-github-username.github.io/plugin/repo.json`
4. Select the plugins you want to install

### Manual Installation
1. Clone this repository
2. Install SkyStream CLI: `npm install -g skystream-cli`
3. Test a plugin: `skystream test -f getHome -p StreamingCommunity`

## 🛠️ Development

### Prerequisites
- Node.js 18+
- SkyStream CLI (`npm install -g skystream-cli`)

### Testing
```bash
# Test homepage
skystream test -f getHome -p PluginName

# Test search
skystream test -f search -q "query" -p PluginName

# Test loading a title
skystream test -f load -q "URL" -p PluginName

# Test stream extraction
skystream test -f loadStreams -q "URL" -p PluginName
```

### Plugin Structure
```
PluginName/
├── manifest.json     # Plugin metadata (name, baseUrl, version)
└── plugin.js         # Core logic (getHome, search, load, loadStreams)
```

### Core Functions
Each plugin implements 4 functions:

| Function | Purpose | Returns |
|:---------|:--------|:--------|
| `getHome(cb)` | Homepage categories | `{ "Category": [MultimediaItem...] }` |
| `search(query, cb)` | Search results | `[MultimediaItem...]` |
| `load(url, cb)` | Title details + episodes | `MultimediaItem` with episodes |
| `loadStreams(url, cb)` | Video stream URLs | `[StreamResult...]` |

## ⚠️ Disclaimer

These plugins are provided for educational purposes only. The developers are not responsible for any misuse. Please respect copyright laws in your jurisdiction.

## 📝 License

MIT License - See [LICENSE](LICENSE) for details.

## 🙏 Credits

- Original plugins by [doGior](https://github.com/doGior)
- Ported to SkyStream architecture
- Powered by [SkyStream](https://github.com/akashdh11/skystream)
