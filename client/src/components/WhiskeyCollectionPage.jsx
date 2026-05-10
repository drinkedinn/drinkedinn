import { useState, useMemo } from 'react';
import api from '../api';
import { useTheme } from '../context/ThemeContext';

const WHISKIES = [
  // ── SCOTCH SINGLE MALT ──
  { id:1,  name:'Macallan 12 Sherry Oak',    distillery:'The Macallan',       country:'Scotland', region:'Speyside',    type:'Single Malt', age:12, abv:40,  price:'$$',   color:'#b5651d', nose:'Dried fruits, vanilla, orange peel, ginger',            palate:'Rich sherry, chocolate, dried fruits, spice',           finish:'Long, warm, oak & dried fruit',       desc:'The benchmark sherry-matured Scotch. Aged exclusively in hand-picked sherry seasoned oak casks from Jerez, Spain.' },
  { id:2,  name:'Glenfiddich 15 Solera',     distillery:'Glenfiddich',        country:'Scotland', region:'Speyside',    type:'Single Malt', age:15, abv:40,  price:'$$',   color:'#c8860a', nose:'Cinnamon, nutmeg, fresh oak, vanilla',                   palate:'Creamy toffee, dried fruit, spiced oak',                finish:'Distinctively sweet, smooth finish',  desc:'Finished in a unique Solera vat — a large oak tun, always kept at least half full, blending together three types of cask.' },
  { id:3,  name:'Lagavulin 16',              distillery:'Lagavulin',          country:'Scotland', region:'Islay',       type:'Single Malt', age:16, abv:43,  price:'$$$',  color:'#8B4513', nose:'Intense peat smoke, iodine, seaweed, sherry',            palate:'Peat, dark chocolate, dried fruit, espresso',          finish:'Exceptionally long, dry peaty smoke', desc:'The definitive Islay single malt. Smoky, peaty and complex — one of the most iconic whiskies in the world.' },
  { id:4,  name:'Laphroaig 10',             distillery:'Laphroaig',          country:'Scotland', region:'Islay',       type:'Single Malt', age:10, abv:40,  price:'$$',   color:'#a0522d', nose:'Heavy peat smoke, iodine, brine, medicinal',             palate:'Peat, seaweed, vanilla, oak',                           finish:'Long, smoky, medicinal',              desc:'The most richly flavoured of all Scotch whiskies. Love it or loathe it — nobody forgets their first sip.' },
  { id:5,  name:'Glenlivet 18',             distillery:'The Glenlivet',      country:'Scotland', region:'Speyside',    type:'Single Malt', age:18, abv:43,  price:'$$$',  color:'#d4a017', nose:'Floral, citrus, vanilla, butterscotch',                  palate:'Soft fruit, oak, spice, toffee',                        finish:'Smooth, lingering, spiced oak',       desc:'Aged in a combination of American and European oak casks. Elegant, complex and beautifully balanced.' },
  { id:6,  name:'Highland Park 12 Viking Honour', distillery:'Highland Park', country:'Scotland', region:'Highland',   type:'Single Malt', age:12, abv:40,  price:'$$',   color:'#c8860a', nose:'Heather, honey, peat smoke, dried fruit',               palate:'Malt, smoke, spice, orange peel',                       finish:'Warm, lingering, slightly smoky',      desc:'From Kirkwall in Orkney — the most northerly distillery in Scotland. Part Viking, part Scotch, all extraordinary.' },
  { id:7,  name:'Balvenie DoubleWood 12',   distillery:'The Balvenie',       country:'Scotland', region:'Speyside',    type:'Single Malt', age:12, abv:40,  price:'$$',   color:'#d4730a', nose:'Honey, vanilla, fruit, subtle spice',                    palate:'Creamy toffee, sherry, hazelnut, fruit',                finish:'Long, smooth, warming',               desc:'Aged first in American oak whisky casks, then in European oak Oloroso sherry casks. The classic double maturation.' },
  { id:8,  name:'Oban 14',                  distillery:'Oban',               country:'Scotland', region:'West Highland',type:'Single Malt', age:14, abv:43,  price:'$$',   color:'#b8860b', nose:'Sea salt, dried fruit, malt, light smoke',               palate:'Fruit, malt, spice, brine',                             finish:'Medium, citrus and smoke',            desc:'A coastal classic from one of Scotland\'s oldest distilleries. Bridges Highland and Islay styles perfectly.' },
  { id:9,  name:'Dalmore 15',               distillery:'The Dalmore',        country:'Scotland', region:'Highland',    type:'Single Malt', age:15, abv:40,  price:'$$$',  color:'#8B0000', nose:'Rich fruitcake, sherry, orange zest, chocolate',         palate:'Christmas spice, dark chocolate, dried berry',          finish:'Long, rich, chocolate and spice',     desc:'Aged in American white oak ex-bourbon casks then finished in Matusalem oloroso sherry casks. Stag on the label, beast inside.' },
  { id:10, name:'Springbank 10',            distillery:'Springbank',         country:'Scotland', region:'Campbeltown', type:'Single Malt', age:10, abv:46,  price:'$$',   color:'#c47a3e', nose:'Brine, vanilla, light peat, tropical fruit',             palate:'Creamy, salt caramel, malt, pepper',                    finish:'Warming, long, slightly peaty',       desc:'One of Scotland\'s most traditional and revered distilleries. Partially peated, bottled at natural strength.' },
  { id:11, name:'Ardbeg 10',               distillery:'Ardbeg',             country:'Scotland', region:'Islay',       type:'Single Malt', age:10, abv:46,  price:'$$',   color:'#a0522d', nose:'Peat, anise, vanilla, espresso',                          palate:'Intense smoke, lemon zest, pepper, dark chocolate',     finish:'Very long, tarry, peaty',             desc:'The peatiest, smokiest, most complex of all the Islay malts — and at cask strength, unapologetically so.' },
  { id:12, name:'Glenfarclas 105',          distillery:'Glenfarclas',        country:'Scotland', region:'Speyside',    type:'Single Malt', age:null,abv:60,  price:'$$$',  color:'#8B4513', nose:'Sherry, dried fruit, Christmas cake, oak spice',         palate:'Rich, warming sherry, dark fruit, coffee',              finish:'Incredibly long and warming',         desc:'A family-owned Speyside classic bottled at cask strength (60% ABV). The "105" refers to the British proof.' },

  // ── SCOTCH BLENDED ──
  { id:13, name:'Johnnie Walker Blue Label', distillery:'Johnnie Walker',     country:'Scotland', region:'Blended',     type:'Blended',     age:null,abv:40,  price:'$$$$', color:'#4169e1', nose:'Sweet fruits, light smoke, honey, spice',                palate:'Dried fruit, vanilla, smoke, chocolate orange',         finish:'Long, silky, gentle smoke',           desc:'The pinnacle of the Johnnie Walker range. Uses whiskies from distilleries now silent — a taste of history.' },
  { id:14, name:'Chivas Regal 18',          distillery:'Chivas Brothers',     country:'Scotland', region:'Blended',     type:'Blended',     age:18, abv:40,  price:'$$$',  color:'#d4a017', nose:'Hazelnut, dried fruit, orange blossom, spice',           palate:'Creamy toffee, orange, cinnamon, nut',                  finish:'Smooth, long, buttery',               desc:'A blend of whiskies each aged at least 18 years. Gold Medal winner at the International Spirits Challenge.' },
  { id:15, name:'Monkey Shoulder',          distillery:'William Grant & Sons',country:'Scotland', region:'Blended Malt',type:'Blended Malt',age:null,abv:40,  price:'$',    color:'#d4a017', nose:'Vanilla, spiced orange, malt biscuit',                   palate:'Smooth vanilla, honey, spiced fruit',                   finish:'Smooth, long, malty',                 desc:'A blend of three Speyside single malts: Glenfiddich, Balvenie and Kininvie. Made for mixing, perfect for drinking neat.' },

  // ── JAPANESE ──
  { id:16, name:'Yamazaki 12',              distillery:'Suntory',            country:'Japan',    region:'Osaka',       type:'Single Malt', age:12, abv:43,  price:'$$$',  color:'#d4a017', nose:'Strawberry, oak, peach, plum',                           palate:'Peach, pineapple, grapefruit, clove',                   finish:'Coconut, vanilla, elegant and long',  desc:'Japan\'s first and most famous single malt distillery. Complex yet harmonious — won Best Single Malt at the World Whiskies Awards.' },
  { id:17, name:'Hibiki Japanese Harmony',  distillery:'Suntory',            country:'Japan',    region:'Blended',     type:'Blended',     age:null,abv:43,  price:'$$$',  color:'#e8b04b', nose:'Rose, lychee, candied orange peel',                      palate:'Honey, sweet orange peel, white chocolate',             finish:'Subtle, lingering hint of Japanese oak',desc:'A harmony of Japanese whiskies. The 24-faceted bottle represents the 24 seasons of the ancient Japanese calendar.' },
  { id:18, name:'Nikka From The Barrel',    distillery:'Nikka',              country:'Japan',    region:'Blended',     type:'Blended',     age:null,abv:51.4,price:'$$',   color:'#c8860a', nose:'Raisins, dried fruits, vanilla, spice',                  palate:'Rich and full, chocolate, malt, spice',                 finish:'Long, warming, spiced',               desc:'A powerhouse blend bottled at 51.4% ABV. One of the world\'s best-value whiskies — endlessly complex.' },
  { id:19, name:'Hakushu 12',              distillery:'Suntory',            country:'Japan',    region:'Japanese Alps',type:'Single Malt',age:12, abv:43,  price:'$$$',  color:'#d4c17a', nose:'Herbal, green apple, light smoke, mint',                  palate:'Fresh, light peat, mint, kiwi, malt',                   finish:'Clean, refreshing, lingering smoke',  desc:'The "mountain distillery" — located in a forest near the Japanese Alps. Refreshingly light and aromatic.' },
  { id:20, name:'Nikka Coffey Grain',       distillery:'Nikka',              country:'Japan',    region:'Miyagikyo',   type:'Grain',       age:null,abv:45,  price:'$$$',  color:'#f4c430', nose:'Tropical fruits, vanilla, caramel, coconut',              palate:'Sweet corn, coconut, vanilla, cream',                   finish:'Long, sweet, tropical',               desc:'Made using a rare Coffey (column) still. Unusually rich and fruity for a grain whisky — a revelation.' },
  { id:21, name:'Toki',                     distillery:'Suntory',            country:'Japan',    region:'Blended',     type:'Blended',     age:null,abv:43,  price:'$$',   color:'#e8c87a', nose:'Basil, green apple, honey, grapefruit',                   palate:'Herbal, light vanilla, pear, ginger ale',               finish:'Subtle, clean, light spice',          desc:'A lighter Japanese blend designed for highballs. Named after the Japanese word for "time".' },

  // ── IRISH ──
  { id:22, name:'Redbreast 12',             distillery:'Midleton',           country:'Ireland',  region:'Cork',        type:'Single Pot Still',age:12,abv:40, price:'$$',   color:'#c8860a', nose:'Sherry, toasted wood, spice, dried fruit',               palate:'Pot still spice, fruit, sherry, barley',                finish:'Long, spicy, warming',                desc:'The definitive expression of Single Pot Still Irish whiskey. Rich, complex and utterly distinctive.' },
  { id:23, name:'Jameson',                  distillery:'Midleton',           country:'Ireland',  region:'Cork',        type:'Blended',     age:null,abv:40,  price:'$',    color:'#c8860a', nose:'Toasted wood, vanilla, spice',                           palate:'Light, smooth, nutty with hints of spice',              finish:'Light, clean, quick',                 desc:'The world\'s best-selling Irish whiskey. Triple-distilled for exceptional smoothness. The gateway Irish.' },
  { id:24, name:'Bushmills 21',             distillery:'Old Bushmills',      country:'Ireland',  region:'Antrim',      type:'Single Malt', age:21, abv:40,  price:'$$$$', color:'#d4a017', nose:'Dried fruit, sherry, vanilla, chocolate',                 palate:'Rich fruit, sherry, chocolate, oak',                    finish:'Long, warming, chocolate and fruit',  desc:'From the world\'s oldest licensed distillery (1608). Finished in Madeira casks for incredible richness.' },
  { id:25, name:'Green Spot',               distillery:'Midleton',           country:'Ireland',  region:'Cork',        type:'Single Pot Still',age:null,abv:40,price:'$$',  color:'#b8860b', nose:'Orchard fruit, spring flowers, fresh barley',            palate:'Creamy mouthfeel, spice, toasted wood',                 finish:'Medium, crisp, fruit',                desc:'A historic bottling revived by Mitchell & Son. Aged in ex-bourbon and Oloroso sherry casks.' },
  { id:26, name:'Teeling Single Grain',     distillery:'Teeling',            country:'Ireland',  region:'Dublin',      type:'Single Grain', age:null,abv:46, price:'$$',   color:'#f4c430', nose:'Vanilla, coconut, tropical fruit',                        palate:'Sweet caramel, vanilla, tropical fruit',                finish:'Clean, medium, slightly sweet',        desc:'Distilled from a blend of corn and barley mash, aged in ex-Californian red wine casks. Approachable and unique.' },

  // ── AMERICAN BOURBON ──
  { id:27, name:'Buffalo Trace',            distillery:'Buffalo Trace',      country:'USA',      region:'Kentucky',    type:'Bourbon',     age:null,abv:40,  price:'$',    color:'#c47a3e', nose:'Vanilla, mint, molasses, toffee',                        palate:'Brown sugar, spice, vanilla, oak',                      finish:'Long, smooth, spicy',                 desc:'Named after the ancient buffalo crossing — the most awarded distillery in the world. A benchmark bourbon at an incredible price.' },
  { id:28, name:'Pappy Van Winkle 15',      distillery:'Buffalo Trace',      country:'USA',      region:'Kentucky',    type:'Bourbon',     age:15, abv:53.5,price:'$$$$', color:'#8B4513', nose:'Vanilla, caramel, oak, leather',                          palate:'Rich caramel, vanilla, dried fruit, spice',             finish:'Endlessly long, incredibly smooth',   desc:'The most coveted bourbon in America. Made from a wheated mashbill. If you find a bottle, buy it immediately.' },
  { id:29, name:'Woodford Reserve',         distillery:'Woodford Reserve',   country:'USA',      region:'Kentucky',    type:'Bourbon',     age:null,abv:43.2,price:'$$',   color:'#c8860a', nose:'Dried fruit, vanilla, cocoa, spice',                     palate:'Chocolate, tobacco, spice, orange',                     finish:'Long, clean, warm',                   desc:'Triple-distilled in copper pot stills. One of the most sophisticated bourbons — the official bourbon of the Kentucky Derby.' },
  { id:30, name:'Four Roses Single Barrel', distillery:'Four Roses',         country:'USA',      region:'Kentucky',    type:'Bourbon',     age:null,abv:50,  price:'$$$',  color:'#c47a3e', nose:'Bold fruit, herbs, caramel, honey',                       palate:'Pear, vanilla, caramel, spice',                         finish:'Long, smooth, fruity',                desc:'Selected from a single barrel, each with unique character. One of the most complex and elegant American bourbons.' },
  { id:31, name:'Blanton\'s Original',      distillery:'Buffalo Trace',      country:'USA',      region:'Kentucky',    type:'Bourbon',     age:null,abv:46.5,price:'$$$',  color:'#c8860a', nose:'Citrus, vanilla, floral, caramel',                        palate:'Fruity citrus, caramel, pepper, toasted oak',           finish:'Dry, long, spiced',                   desc:'The world\'s first commercially produced single barrel bourbon (1984). The distinctive bottle stopper is collectible.' },
  { id:32, name:'Knob Creek 9',             distillery:'Beam Suntory',       country:'USA',      region:'Kentucky',    type:'Bourbon',     age:9,  abv:50,  price:'$$',   color:'#8B4513', nose:'Maple, nuts, vanilla, fruit',                             palate:'Full-bodied, caramel, nuts, charred oak',               finish:'Long, bold, spiced',                  desc:'Named after Abraham Lincoln\'s boyhood home. A pre-Prohibition style, full-flavored small batch bourbon.' },
  { id:33, name:'Maker\'s Mark',            distillery:'Maker\'s Mark',      country:'USA',      region:'Kentucky',    type:'Bourbon',     age:null,abv:45,  price:'$',    color:'#d4a017', nose:'Sweet, soft wheat, vanilla, caramel',                     palate:'Smooth caramel, vanilla, soft wheat',                   finish:'Clean, short, sweet',                 desc:'Bottled by hand — including that iconic red wax seal. A wheated bourbon that\'s irresistibly smooth.' },
  { id:34, name:'Eagle Rare 10',            distillery:'Buffalo Trace',      country:'USA',      region:'Kentucky',    type:'Bourbon',     age:10, abv:45,  price:'$$',   color:'#c8860a', nose:'Toffee, hints of orange, herbs, oak',                     palate:'Rich toffee, dry oak, leather, dark cocoa',             finish:'Long, bold, dry',                     desc:'A single barrel bourbon aged at least 10 years. Each barrel is individually inspected before bottling.' },

  // ── AMERICAN RYE ──
  { id:35, name:'Whistlepig 10',            distillery:'Whistlepig',         country:'USA',      region:'Vermont',     type:'Rye',         age:10, abv:50,  price:'$$$',  color:'#c47a3e', nose:'Mint, vanilla, caramel, cinnamon',                        palate:'Rich rye spice, vanilla, caramel, pepper',              finish:'Long, warming, spiced',               desc:'100% rye mash bill, aged 10 years. Set the gold standard for the American rye whiskey renaissance.' },
  { id:36, name:'Sazerac Rye',             distillery:'Buffalo Trace',      country:'USA',      region:'Kentucky',    type:'Rye',         age:null,abv:45,  price:'$$',   color:'#c8860a', nose:'Peppery spice, honey, anise',                             palate:'Rye spice, mint, pepper, citrus',                       finish:'Medium, dry, spiced',                 desc:'The classic American rye whiskey — the spirit behind New Orleans\'s iconic Sazerac cocktail.' },
  { id:37, name:'Rittenhouse Rye BIB',     distillery:'Heaven Hill',        country:'USA',      region:'Kentucky',    type:'Rye',         age:4,  abv:50,  price:'$',    color:'#c8860a', nose:'Clove, cinnamon, vanilla, fresh oak',                     palate:'Bold rye, pepper, sweet oak, spice',                    finish:'Bold, dry, long',                     desc:'Bottled-in-Bond (100 proof) rye. The bartender\'s rye of choice for classic cocktails — also outstanding neat.' },

  // ── INDIAN ──
  { id:38, name:'Amrut Fusion',             distillery:'Amrut',              country:'India',    region:'Bangalore',   type:'Single Malt', age:null,abv:50,  price:'$$',   color:'#c8860a', nose:'Sweet malt, tropical fruit, light spice',                 palate:'Mango, coconut, spice, oak',                            finish:'Long, warming, spiced',               desc:'A blend of Indian unpeated barley and Scottish peated barley. Named the 3rd finest whisky in the world by Jim Murray in 2010.' },
  { id:39, name:'Paul John Bold',           distillery:'John Distilleries',  country:'India',    region:'Goa',         type:'Single Malt', age:null,abv:46,  price:'$$',   color:'#d4a017', nose:'Spice, mango, vanilla, light peat',                       palate:'Bold spice, tropical fruit, oak, peat',                 finish:'Long, spiced, warming',               desc:'Crafted from 6-row Indian barley, aged in American oak. The warm tropical climate accelerates maturation dramatically.' },
  { id:40, name:'Rampur Double Cask',       distillery:'Radico Khaitan',     country:'India',    region:'Uttar Pradesh',type:'Single Malt',age:null,abv:45, price:'$$',   color:'#c47a3e', nose:'Tropical fruit, vanilla, toffee',                         palate:'Mango, papaya, vanilla, milk chocolate',                finish:'Medium, smooth, tropical fruit',      desc:'Aged in American bourbon barrels and European oak sherry casks at the foot of the Himalayas. Fascinatingly exotic.' },
  { id:41, name:'Amrut Peated',             distillery:'Amrut',              country:'India',    region:'Bangalore',   type:'Single Malt', age:null,abv:46,  price:'$$',   color:'#a0522d', nose:'Peat smoke, malt, tropical fruit',                        palate:'Smoke, mango, pepper, oak',                             finish:'Peaty, warming, long',                desc:'Indian barley peated to a phenol level of around 25 ppm. Tropical meets smoky — a genuinely unique whisky experience.' },
  { id:42, name:'Indri Trini',              distillery:'Piccadily Distilleries',country:'India', region:'Haryana',     type:'Single Malt', age:null,abv:46,  price:'$$',   color:'#d4a017', nose:'Honey, tropical fruit, vanilla, light spice',             palate:'Mango, honey, oak, dried fruit',                        finish:'Smooth, medium, fruity',              desc:'Triple casked in ex-bourbon, ex-wine and ex-PX sherry casks. India\'s fastest growing premium single malt.' },

  // ── CANADIAN ──
  { id:43, name:'Crown Royal',              distillery:'Diageo Canada',       country:'Canada',  region:'Manitoba',    type:'Blended',     age:null,abv:40,  price:'$',    color:'#d4a017', nose:'Vanilla, caramel, dried fruit',                          palate:'Soft rye, vanilla, light caramel',                      finish:'Smooth, short, clean',                desc:'Originally created in 1939 for King George VI\'s visit to Canada. The iconic purple bag is part of the legend.' },
  { id:44, name:'Whistlepig The Boss Hog',  distillery:'Whistlepig',         country:'Canada',  region:'Alberta',     type:'Rye',         age:13, abv:60,  price:'$$$$', color:'#c47a3e', nose:'Intense rye, cinnamon, caramel, leather',                 palate:'Bold rye spice, vanilla, leather, pepper',              finish:'Very long, warming, complex',         desc:'An annual limited edition. Boss Hog VIII "Lapulapu\'s Pacific" — aged in Philippine rum casks. Extraordinary.' },

  // ── TAIWANESE ──
  { id:45, name:'Kavalan Solist Vinho Barrique', distillery:'Kavalan',       country:'Taiwan',  region:'Yilan',       type:'Single Malt', age:null,abv:57.8,price:'$$$$', color:'#8B4513', nose:'Wine-soaked raisins, vanilla, tropical fruit',           palate:'Rich dried fruit, wine, spice, toffee',                 finish:'Very long, fruity, warming',          desc:'Aged in wine barrique casks. Taiwan\'s scorching heat ages whisky rapidly — this is as complex as a 20-year Scotch.' },
  { id:46, name:'Kavalan Classic',           distillery:'Kavalan',           country:'Taiwan',  region:'Yilan',       type:'Single Malt', age:null,abv:40,  price:'$$',   color:'#d4a017', nose:'Vanilla, tropical fruit, toffee',                         palate:'Creamy, sweet, tropical fruit, vanilla',                finish:'Clean, sweet, medium',                desc:'Taiwan\'s most awarded whisky. The mineral-rich water from Snow Mountain gives it exceptional character.' },

  // ── WELSH ──
  { id:47, name:'Penderyn Madeira',          distillery:'Penderyn',          country:'Wales',   region:'Brecon Beacons',type:'Single Malt',age:null,abv:46, price:'$$',   color:'#c8860a', nose:'Sweet vanilla, caramel, fruit',                           palate:'Honey, vanilla, sweet Madeira, fruit',                  finish:'Medium, sweet, fruity',               desc:'The first Welsh whisky in over a century. Finished in Madeira casks — light, sweet and distinctive.' },

  // ── SWEDISH ──
  { id:48, name:'Mackmyra Brukswhisky',      distillery:'Mackmyra',          country:'Sweden',  region:'Gävle',       type:'Single Malt', age:null,abv:41.4,price:'$$',   color:'#d4c17a', nose:'Vanilla, light floral, meadow herbs',                     palate:'Smooth, vanilla, light juniper, gentle spice',          finish:'Clean, medium, herbal',               desc:'Sweden\'s first whisky distillery. Uses Swedish barley, Swedish juniper wood and local peat — truly Nordic.' },

  // ── FRENCH ──
  { id:49, name:'Bellevoye Blanc',           distillery:'Bellevoye',         country:'France',  region:'Alsace',      type:'Blended Malt', age:null,abv:40, price:'$$',   color:'#f4e87a', nose:'Fresh, floral, honey, light fruit',                        palate:'Creamy, vanilla, pear, light spice',                    finish:'Short, clean, elegant',               desc:'Triple malt whisky from three French distilleries, aged in Burgundy wine casks. The French take on whisky — and it works.' },

  // ── ENGLISH ──
  { id:50, name:'The English Whisky Chapter 14', distillery:'The English Whisky Co.',country:'England',region:'Norfolk',type:'Single Malt',age:null,abv:46, price:'$$',  color:'#d4a017', nose:'Sweet malt, vanilla, fresh fruit',                        palate:'Caramel, light fruit, oak, honey',                      finish:'Medium, clean, slightly spiced',      desc:'The first whisky legally distilled in England since 1905. Uses Norfolk-grown barley — a true English terroir.' },

  // ── AUSTRALIAN ──
  { id:51, name:'Starward Nova',             distillery:'Starward',          country:'Australia',region:'Melbourne',  type:'Single Malt', age:null,abv:41,  price:'$$',   color:'#c8860a', nose:'Red wine, cherry, vanilla, grain',                        palate:'Berry, cherry, vanilla, grain',                         finish:'Short, fruity, clean',                desc:'Matured entirely in Australian red wine barrels from the Barossa and Yarra Valley. The antipodean surprise.' },
  { id:52, name:'Lark Classic Cask',         distillery:'Lark',              country:'Australia',region:'Tasmania',   type:'Single Malt', age:null,abv:43,  price:'$$$',  color:'#c47a3e', nose:'Honey, vanilla, light peat, dried fruit',                 palate:'Rich malt, honey, peat, dark chocolate',                finish:'Long, warming, peaty',                desc:'From the island of Tasmania — using local barley and Tasmanian peat. Australia\'s most iconic whisky.' },

  // ── SOUTH AFRICAN ──
  { id:53, name:'Bain\'s Cape Mountain',     distillery:'James Sedgwick',    country:'South Africa',region:'Wellington',type:'Single Grain',age:null,abv:40, price:'$$',  color:'#f4c430', nose:'Vanilla, butterscotch, toffee',                           palate:'Creamy vanilla, toffee, light wood',                    finish:'Smooth, medium, sweet',               desc:'The only South African grain whisky. Double-matured in first-fill bourbon barrels. World\'s Best Grain Whisky 2022.' },

  // ── ADDITIONAL SCOTCH ──
  { id:54, name:'Glenfarclas 21',            distillery:'Glenfarclas',       country:'Scotland', region:'Speyside',    type:'Single Malt', age:21, abv:43,  price:'$$$$', color:'#8B0000', nose:'Rich sherry, dried fruit, toffee, spice',                 palate:'Christmas cake, sherry, dark chocolate',                finish:'Very long, sherried, warming',        desc:'Fully sherried throughout maturation. The Glenfarclas family has owned this distillery since 1865 — old-school excellence.' },
  { id:55, name:'Bruichladdich The Classic', distillery:'Bruichladdich',     country:'Scotland', region:'Islay',       type:'Single Malt', age:null,abv:50,  price:'$$',   color:'#d4c17a', nose:'Fresh barley, floral, light citrus',                       palate:'Creamy, floral, citrus, malt',                          finish:'Medium, clean, subtly fruity',        desc:'100% Scottish barley, no peat. Progressive Hebridean Distillery doing things differently — and brilliantly.' },
  { id:56, name:'Caol Ila 12',              distillery:'Caol Ila',          country:'Scotland', region:'Islay',       type:'Single Malt', age:12, abv:43,  price:'$$',   color:'#a0724a', nose:'Smoke, lemon, medicine, green pepper',                     palate:'Oily, peaty, citrus, malt',                             finish:'Long, smoky, coastal',                desc:'The largest distillery on Islay, yet one of the least known. A smoky gem that whisky geeks adore.' },
  { id:57, name:'Tomatin 14 Port',          distillery:'Tomatin',           country:'Scotland', region:'Highland',    type:'Single Malt', age:14, abv:46,  price:'$$',   color:'#8B0000', nose:'Red berries, wine, vanilla, spice',                        palate:'Port wine, cherry, spice, chocolate',                   finish:'Long, fruity, wine-influenced',       desc:'Finished in Port casks from the Douro Valley. A Highland malt transformed into something wonderfully different.' },
  { id:58, name:'Auchentoshan Three Wood',  distillery:'Auchentoshan',      country:'Scotland', region:'Lowland',     type:'Single Malt', age:null,abv:43,  price:'$$',   color:'#8B4513', nose:'Toffee, dried fruit, sherry, coconut',                    palate:'Complex sherry, fruit, toffee, cinnamon',               finish:'Long, warming, rich',                 desc:'Triple distilled and matured in three cask types: Bourbon, Oloroso Sherry and Pedro Ximénez. Remarkable complexity.' },
];

const REGIONS = ['All', 'Speyside', 'Islay', 'Highland', 'Lowland', 'Campbeltown', 'West Highland', 'Blended', 'Blended Malt', 'Kentucky', 'Vermont', 'Osaka', 'Japanese Alps', 'Miyagikyo', 'Cork', 'Antrim', 'Dublin', 'Bangalore', 'Goa', 'Haryana', 'Uttar Pradesh', 'Yilan', 'Melbourne', 'Tasmania', 'Wellington'];
const TYPES   = ['All', 'Single Malt', 'Blended', 'Blended Malt', 'Bourbon', 'Rye', 'Single Pot Still', 'Grain', 'Single Grain'];
const COUNTRIES = ['All', 'Scotland', 'Japan', 'Ireland', 'USA', 'India', 'Canada', 'Taiwan', 'Australia', 'Wales', 'Sweden', 'France', 'England', 'South Africa'];
const PRICES  = ['All', '$', '$$', '$$$', '$$$$'];

const PRICE_LABEL = { '$': 'Budget (<₹3k)', '$$': 'Mid (₹3–8k)', '$$$': 'Premium (₹8–20k)', '$$$$': 'Luxury (₹20k+)' };
const FLAG = { Scotland:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', Japan:'🇯🇵', Ireland:'🇮🇪', USA:'🇺🇸', India:'🇮🇳', Canada:'🇨🇦', Taiwan:'🇹🇼', Australia:'🇦🇺', Wales:'🏴󠁧󠁢󠁷󠁬󠁳󠁿', Sweden:'🇸🇪', France:'🇫🇷', England:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'South Africa':'🇿🇦' };

export default function WhiskeyCollectionPage() {
  const { t } = useTheme();
  const [search, setSearch]       = useState('');
  const [country, setCountry]     = useState('All');
  const [type, setType]           = useState('All');
  const [price, setPrice]         = useState('All');
  const [selected, setSelected]   = useState(null);
  const [addedToBar, setAddedToBar] = useState({});
  const [addedToBucket, setAddedToBucket] = useState({});

  const filtered = useMemo(() => WHISKIES.filter(w => {
    if (country !== 'All' && w.country !== country) return false;
    if (type !== 'All' && w.type !== type) return false;
    if (price !== 'All' && w.price !== price) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!w.name.toLowerCase().includes(q) && !w.distillery.toLowerCase().includes(q) && !w.region.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [search, country, type, price]);

  const addToCollection = async (w) => {
    try {
      await api.post('/collection', { name: w.name, distillery: w.distillery, drink_type: w.type, notes: `${w.nose}. ${w.palate}.` });
      setAddedToBar(a => ({ ...a, [w.id]: true }));
    } catch {}
  };

  const addToBucket = async (w) => {
    try {
      await api.post('/bucketlist', { drink_name: w.name });
      setAddedToBucket(a => ({ ...a, [w.id]: true }));
    } catch {}
  };

  const chip = (label, value, set, current) => (
    <button key={value} onClick={() => set(value)} style={{
      background: current === value ? t.accentSoft : t.card,
      border: `1.5px solid ${current === value ? t.accent : t.border}`,
      borderRadius: 20, padding: '6px 14px',
      color: current === value ? t.accent : t.textMuted,
      fontWeight: current === value ? 700 : 500, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
    }}>{label}</button>
  );

  const cardStyle = { background: t.card, borderRadius: 16, padding: 18, border: `1px solid ${t.border}`, boxShadow: t.shadow, cursor: 'pointer', transition: 'all 0.2s' };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <span style={{ fontSize: 32 }}>🥃</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 22, color: t.text }}>World Whiskey Collection</div>
            <div style={{ fontSize: 13, color: t.textMuted }}>{WHISKIES.length} whiskies from {COUNTRIES.length - 1} countries — your global knowledge base</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: t.textMuted }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search whiskey, distillery or region…"
          style={{ width: '100%', background: t.card, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: '12px 14px 12px 40px', color: t.text, fontSize: 14, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
          onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.border} />
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: t.textFaint, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Country</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {COUNTRIES.map(c => chip(`${c !== 'All' ? (FLAG[c] || '') + ' ' : ''}${c}`, c, setCountry, country))}
        </div>
        <div style={{ fontSize: 11, color: t.textFaint, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Type</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {TYPES.map(tp => chip(tp, tp, setType, type))}
        </div>
        <div style={{ fontSize: 11, color: t.textFaint, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Price Range</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PRICES.map(p => chip(p === 'All' ? 'All Prices' : `${p} ${PRICE_LABEL[p]}`, p, setPrice, price))}
        </div>
      </div>

      {/* Count */}
      <div style={{ fontSize: 12, color: t.textFaint, margin: '14px 0 12px', fontWeight: 500 }}>
        Showing {filtered.length} of {WHISKIES.length} whiskies
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {filtered.map(w => (
          <div key={w.id} style={cardStyle}
            onClick={() => setSelected(w)}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = t.shadowMd; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = t.shadow; }}
          >
            {/* Color bar */}
            <div style={{ height: 6, borderRadius: 4, background: w.color, marginBottom: 14, opacity: 0.8 }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: t.text, lineHeight: 1.3, marginBottom: 2 }}>{w.name}</div>
                <div style={{ fontSize: 12, color: t.textMuted }}>{FLAG[w.country] || ''} {w.distillery}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: t.accent }}>{w.price}</span>
                {w.age && <span style={{ fontSize: 11, color: t.textFaint, background: t.cardAlt, borderRadius: 10, padding: '2px 8px' }}>{w.age}yr</span>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ fontSize: 11, background: t.accentSoft, color: t.accent, borderRadius: 10, padding: '2px 8px', fontWeight: 600 }}>{w.type}</span>
              <span style={{ fontSize: 11, background: t.cardAlt, color: t.textMuted, borderRadius: 10, padding: '2px 8px' }}>{w.region}</span>
              <span style={{ fontSize: 11, background: t.cardAlt, color: t.textMuted, borderRadius: 10, padding: '2px 8px' }}>{w.abv}% ABV</span>
            </div>

            <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {w.desc}
            </div>

            <div style={{ marginTop: 10, fontSize: 11, color: t.textFaint }}>
              <span style={{ fontWeight: 600 }}>Nose:</span> {w.nose.split(',')[0]}…
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: t.textMuted }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🥃</div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>No whiskies found</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Try adjusting your filters</div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: t.overlay, backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setSelected(null)}>
          <div className="popIn" onClick={e => e.stopPropagation()} style={{
            background: t.card, borderRadius: 24, width: '100%', maxWidth: 640,
            maxHeight: '90vh', overflowY: 'auto',
            border: `1px solid ${t.border}`, boxShadow: t.shadowLg,
          }}>
            {/* Color header */}
            <div style={{ height: 8, background: selected.color, borderRadius: '24px 24px 0 0' }} />

            <div style={{ padding: '24px 28px 28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 22, color: t.text, lineHeight: 1.2, marginBottom: 4 }}>{selected.name}</div>
                  <div style={{ fontSize: 14, color: t.textMuted }}>{FLAG[selected.country] || ''} {selected.distillery} · {selected.region}, {selected.country}</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 24, color: t.textMuted, cursor: 'pointer', marginLeft: 16 }}>×</button>
              </div>

              {/* Tags */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                {[
                  [selected.type, t.accentSoft, t.accent],
                  [selected.region, t.cardAlt, t.textMuted],
                  [`${selected.abv}% ABV`, t.cardAlt, t.textMuted],
                  ...(selected.age ? [[`${selected.age} Years Old`, t.cardAlt, t.textMuted]] : []),
                  [selected.price + ' ' + (PRICE_LABEL[selected.price] || ''), t.cardAlt, t.textMuted],
                ].map(([label, bg, color], i) => (
                  <span key={i} style={{ background: bg, color, borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 600 }}>{label}</span>
                ))}
              </div>

              {/* Description */}
              <p style={{ color: t.textSub, fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>{selected.desc}</p>

              {/* Tasting Notes */}
              <div style={{ background: t.cardAlt, borderRadius: 14, padding: 18, marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Tasting Notes</div>
                {[['👃 Nose', selected.nose], ['👅 Palate', selected.palate], ['🔥 Finish', selected.finish]].map(([label, note]) => (
                  <div key={label} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.accent, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 14, color: t.textSub, lineHeight: 1.5 }}>{note}</div>
                  </div>
                ))}
              </div>

              {/* Colour indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>Colour:</div>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: selected.color, border: `2px solid ${t.border}` }} />
                <div style={{ width: 80, height: 10, borderRadius: 6, background: `linear-gradient(90deg, #f4e87a, ${selected.color})`, border: `1px solid ${t.border}` }} />
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => addToCollection(selected)} style={{
                  flex: 1, background: addedToBar[selected.id] ? t.cardAlt : 'linear-gradient(135deg,#f5a623,#ffcc5c)',
                  border: addedToBar[selected.id] ? `1.5px solid ${t.border}` : 'none',
                  borderRadius: 20, padding: '12px 0', fontWeight: 700, fontSize: 14,
                  color: addedToBar[selected.id] ? t.textMuted : '#fff', cursor: 'pointer', transition: 'all 0.2s',
                }}>
                  {addedToBar[selected.id] ? '✓ In My Bar' : '🗄️ Add to My Bar'}
                </button>
                <button onClick={() => addToBucket(selected)} style={{
                  flex: 1, background: addedToBucket[selected.id] ? t.cardAlt : t.card,
                  border: `1.5px solid ${addedToBucket[selected.id] ? t.border : t.accent}`,
                  borderRadius: 20, padding: '12px 0', fontWeight: 700, fontSize: 14,
                  color: addedToBucket[selected.id] ? t.textMuted : t.accent, cursor: 'pointer', transition: 'all 0.2s',
                }}>
                  {addedToBucket[selected.id] ? '✓ On Bucket List' : '📋 Add to Bucket List'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
