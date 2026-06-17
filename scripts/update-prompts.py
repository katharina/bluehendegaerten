"""One-off: rewrite all plant prompts to the detailed portrait-format style."""
import json, sys
from pathlib import Path

SPECIES_JSON = Path(__file__).parent / "species.json"

PREFIX = "{name}, {common}, portrait format 3:4 ratio, isolated on pure white background, three-quarter view from slightly above, soft natural daylight from the left, photorealistic quality, no shadow, no pot, soil visible at base — "

PROMPTS = {
  "echinacea": {
    "sprout": "early spring emergence: a low flat basal rosette 10–15 cm tall, several broad ovate leaves 5–8 cm long emerging directly from the soil, leaves dark green, surface rough and hairy with prominent veining, margins coarsely toothed, leaf undersides paler, no upright stems or flower buds present, leaves slightly asymmetrical and splayed, rooted visibly in a small mound of dark garden soil",
    "foliage": "late spring vegetative growth: a clump of several upright stems 40–50 cm tall, stems stiff, slightly branching, covered with short rough hairs, alternate leaves along stems 8–15 cm long, dark green, lanceolate to ovate with coarse teeth, rough bristly surface, leaf veins prominent, small rounded flower buds just visible at stem tips, base emerging from dark garden soil, vigorous upright garden habitus",
    "bloom": "full bloom: an upright clump 70–80 cm tall, several stiff hairy stems each bearing a single large flower head, ray petals 3–4 cm long, drooping slightly downward, bright magenta-pink, surrounding a prominent domed spiky central cone 2–3 cm across in warm orange-brown, some flowers fully open, some just opening, rough dark green foliage along stems, basal leaves visible at soil level, soil mound at base, characteristic bold prairie garden presence",
    "seed": "post-bloom seed set: upright clump 70–75 cm tall, several stiff stems, ray petals mostly fallen, prominent dark brown spiky seed cones 3–4 cm across at stem tips and side branches, cone bracts sharp and stiff, some withered petal remnants still clinging, foliage along stems becoming coarser and slightly yellowing, basal foliage still present at soil level, natural late-summer character",
    "dried": "winter standing structure: a clump of 5–8 fully dried upright stems 70–75 cm tall, stems pale tan-brown, rigid and brittle-looking, all foliage gone, each stem crowned with a dark spiky empty seed cone, the architectural silhouette of the spent plant standing against white, rooted in a small mound of dark soil, dramatic skeletal winter garden structure",
  },
  "poppy": {
    "sprout": "early spring emergence: a low spreading basal rosette 10–15 cm tall, several deeply pinnately lobed leaves emerging from soil, leaves rough and covered with coarse bristly hairs, blue-grey-green in colour, margins coarsely toothed and lobed, surface texture noticeably bristly, no upright stems or flower buds present, rooted visibly in a small mound of dark garden soil",
    "foliage": "spring vegetative growth: a full spreading basal clump 20–30 cm tall, large deeply pinnately lobed leaves 15–25 cm long, densely covered in coarse bristly hairs, grey-green to blue-green, leaves widely spreading and lush, no flower stems emerging yet, rooted in dark garden soil, vigorous hairy foliage habitus",
    "bloom": "full bloom: an upright clump 60–70 cm tall, several tall hairy stems each bearing a single large bowl-shaped flower, crinkled petals 8–10 cm wide, vivid scarlet-orange with a bold black blotch at the base of each petal, prominent dark purple-black stamens in the centre, deeply lobed hairy foliage along stems, basal leaves at soil level, soil mound at base, bold dramatic garden presence",
    "seed": "post-bloom seed set: upright stems 55–65 cm tall, petals fallen, each stem topped with an ornamental rounded grey-green pepper-pot seed capsule 3–4 cm across with a flattened disc-like cap, basal foliage yellowing and beginning to die back, characteristic summer dormancy beginning, natural late-spring character",
    "dried": "summer dormancy: several dried upright stems 50–60 cm tall, stems pale tan to grey-brown, each topped with an ornamental dried grey-brown pepper-pot capsule, all foliage gone, stems rigid and architectural, rooted in a small mound of dark soil, elegant skeletal summer dormancy structure",
  },
  "sunflower": {
    "sprout": "seedling emergence: a young sunflower seedling 15–20 cm tall, a pair of large rounded cotyledons spread wide, first rough true leaves emerging between them, stems thickening and slightly hairy, all fresh bright green, rooted in a small mound of dark garden soil, vigorous early growth",
    "foliage": "vegetative growth: a tall upright plant 80–100 cm, a single stout hairy stem bearing several large rough ovate to cordate leaves 15–25 cm long, coarsely toothed, surface rough with short bristles, dark green, a large rounded flower bud just forming at the stem tip, vigorous upright garden habitus",
    "bloom": "full bloom: a single tall stout hairy stem 160–180 cm, topped with one large circular flowerhead 20–30 cm across, a ring of bright golden-yellow ray florets surrounding a large domed dark brown disc of tubular flowers, a few large rough dark green leaves remaining along the upper stem, soil mound at base, iconic summer garden presence",
    "seed": "seed ripening: a tall stem 150–170 cm, the large flowerhead now drooping under its own weight, petals fallen, the disc face packed with developing striped seeds in a herringbone pattern, outer leaves yellowed and drooping, stem beginning to brown, natural late-summer character",
    "dried": "winter standing structure: a single fully dried brown brittle stem 140–160 cm tall, the large empty seed head at the top, seeds mostly shed, the dried disc face ragged and skeletal, no leaves remaining, rooted in a small mound of dark soil, bold architectural winter silhouette",
  },
  "bunias": {
    "sprout": "early spring emergence: a low clump of basal leaves 10–15 cm tall, leaves deeply irregularly lobed and toothed, dark green, surface rough and slightly hairy, margins waved and jagged, no upright stems yet, rooted in a small mound of dark garden soil",
    "foliage": "spring vegetative growth: a large bold basal rosette 40–50 cm tall, large deeply lobed and toothed dark green leaves 20–35 cm long, surface rough, margins jagged, several upright branching stems just beginning to rise from the rosette, vigorous garden habitus",
    "bloom": "full bloom: an upright branching plant 90–100 cm tall, many slender branching stems densely covered with small bright yellow four-petalled flowers, deeply lobed dark green basal leaves still present below, exuberant flowering habitus",
    "seed": "seed ripening: upright branching stems 85–95 cm, flowers replaced by distinctive small knobby-warty ovoid seed pods 5–8 mm long in clusters along stems, pods green-brown, basal foliage yellowing, natural post-bloom character",
    "dried": "winter standing structure: several fully dried upright branching stems 80–90 cm tall, stems pale buff-brown, bearing persistent small warty seed pods now dried and brown, no foliage remaining, branching architectural winter silhouette",
  },
  "aquilegia": {
    "sprout": "early spring emergence: a small clump of delicate compound leaves 10–15 cm tall emerging from soil, leaves blue-green, trifoliate and deeply lobed, each leaflet rounded with scalloped margins, surface smooth and slightly glaucous, no upright stems yet, rooted in a small mound of dark garden soil, delicate spring character",
    "foliage": "spring vegetative growth: a lush mounding clump 30–40 cm tall, compound leaves on branching stems, each leaf trifoliate with rounded deeply lobed blue-green leaflets, surface slightly glaucous, no flower stems yet, soft and airy garden habitus",
    "bloom": "full bloom: an upright branching plant 60–70 cm tall, delicate branching stems bearing nodding spurred flowers, petals rich violet-blue to deep purple 3–4 cm across, distinctive backward-curved spurs 1.5–2 cm long, flowers nodding gracefully, compound blue-green foliage below, charming cottage garden presence",
    "seed": "seed ripening: upright stems 55–65 cm, flowers replaced by clusters of 5 erect slender follicle pods 2–3 cm long, turning from green to papery brown, foliage yellowing and dying back, natural early-summer character",
    "dried": "summer dormancy: several fully dried upright stems 50–60 cm tall, each bearing clusters of open empty follicle pods split along one side, stems pale tan, no foliage remaining, delicate skeletal summer dormancy structure",
  },
  "primula": {
    "sprout": "early spring emergence: a small basal rosette 5–10 cm across, leaves just emerging from soil, oval to oblong, surface softly wrinkled and crinkled, pale yellow-green, margins finely crenated, leaves softly hairy especially on undersides, no flower stem yet, rooted in a small mound of dark soil",
    "foliage": "spring vegetative growth: a full basal rosette 15–20 cm tall, oval wrinkled pale green leaves 5–10 cm long, softly hairy, margins crenated, a short upright flower stem with a cluster of hanging tubular buds just emerging from the rosette centre, charming spring character",
    "bloom": "full bloom: a compact plant 20–25 cm tall, a single upright stem bearing an umbel of 5–15 nodding tubular yellow flowers at the tip, each flower deep golden-yellow with an orange spot in the throat, nodding on individual stalks, softly hairy pale green basal rosette below, delicate meadow character",
    "seed": "seed ripening: upright stems 18–22 cm, flower calyces enlarged and persistent, each enclosing a small ovoid seed capsule, rosette leaves yellowing and flattening as the plant enters summer dormancy, natural post-bloom character",
    "dried": "summer dormancy: plant fully dormant, only a small tight resting bud 2–5 cm tall visible at soil level, no above-ground foliage, rooted in a small mound of dark soil, minimal skeletal presence",
  },
  "phacelia": {
    "sprout": "early spring emergence: a small clump 10–15 cm tall of feathery deeply pinnately divided bright green leaves just emerging from soil, leaves soft and slightly hairy, fresh bright green, delicate texture, no upright stems or buds yet, rooted in a small mound of dark garden soil",
    "foliage": "vegetative growth: a bushy upright clump 30–40 cm tall of feathery deeply pinnately divided bright green leaves on branching stems, leaves softly hairy, texture fine and feathery, characteristic coiled flower buds beginning to form at stem tips, vigorous garden habitus",
    "bloom": "full bloom: an upright branching plant 60–70 cm tall, numerous curling scorpioid cymes uncurling as flowers open, flowers bright lavender-blue to violet, bell-shaped 8–10 mm wide with protruding pale stamens, several cymes at different stages of uncoiling, feathery pinnate foliage below, outstanding bee-attracting character",
    "seed": "seed ripening: upright branching stems 55–65 cm, the characteristic coiled cymes now straightened and bearing small brown nutlet seeds in calyx cups along their length, foliage yellowing and wilting, natural post-bloom character",
    "dried": "late season: fully dried upright branching stems 50–60 cm tall, the uncoiled cymes dried and papery with empty seed cups, stems pale tan, no foliage remaining, fine skeletal structure",
  },
  "calendula": {
    "sprout": "early spring seedling: a young plant 10–15 cm tall, pale green slightly sticky aromatic leaves on short upright stems, leaves oblong to spoon-shaped 4–7 cm, margins slightly wavy, surface slightly sticky, no buds yet, rooted in a small mound of dark garden soil, fresh and vigorous",
    "foliage": "vegetative growth: a bushy branching plant 20–30 cm tall, pale green slightly sticky aromatic leaves on upright stems, leaves 5–12 cm long, oblong to spoon-shaped, margins slightly wavy, small rounded flower buds just beginning to form at branch tips, fresh garden habitus",
    "bloom": "full bloom: a bushy branching plant 40–50 cm tall, multiple upright stems each bearing one large fully double orange flowerhead 5–7 cm across, ray florets numerous and overlapping in rich orange to orange-yellow, disc centre darker, pale green sticky aromatic leaves below, exuberant summer-to-autumn garden character",
    "seed": "seed ripening: upright branching stems 40–45 cm, flowerheads replaced by distinctive rings of curved claw-like achenes 1–2 cm long arranged in a circular crown, pale green foliage yellowing and sparse, natural autumn character",
    "dried": "late season: fully dried branching stems 35–40 cm tall, the dried empty seed crowns still decorative, stems pale brown, no foliage remaining, delicate skeletal structure",
  },
  "anthemis": {
    "sprout": "early spring emergence: a low clump 10–15 cm tall of feathery deeply divided grey-green aromatic leaves just emerging, leaves finely pinnately dissected, surface slightly hairy, grey-green, aromatic when touched, no upright stems yet, rooted in a small mound of dark garden soil",
    "foliage": "spring vegetative growth: a bushy spreading mound 25–35 cm tall of deeply pinnately divided grey-green aromatic leaves on spreading stems, leaves finely textured and feathery, surface slightly hairy, no flower stems yet, neat aromatic garden habitus",
    "bloom": "full bloom: a bushy spreading plant 45–50 cm tall, many upright branching stems each topped with a bright yellow daisy-like flowerhead 3–4 cm across, yellow ray florets surrounding a domed yellow disc, flowers covering the plant, feathery grey-green aromatic foliage below, cheerful summer garden presence",
    "seed": "seed ripening: upright branching stems 40–45 cm, petals fallen from most flowerheads, small button-like dried receptacles bearing tiny seeds, feathery grey-green foliage still present, natural late-summer character",
    "dried": "winter standing structure: fully dried upright stems 35–40 cm tall, the small dried seed heads persistent, stems pale buff-brown, no foliage remaining, fine delicate skeletal winter structure",
  },
  "tithonia": {
    "sprout": "seedling emergence: a young plant 15–20 cm tall, a few broad rough dark green ovate leaves on an upright stem, leaves 8–12 cm long, slightly velvety surface, margins slightly toothed, stems stout and erect, no buds yet, rooted in a small mound of dark garden soil",
    "foliage": "vegetative growth: a bushy upright plant 60–80 cm tall, branching stout stems bearing large rough ovate to triangular dark green leaves 10–20 cm long, surface slightly velvety, veins prominent, large rounded flower buds forming at branch tips, vigorous tropical garden habitus",
    "bloom": "full bloom: a large bushy branching plant 110–130 cm tall, numerous long upright stems each bearing a single vivid orange daisy-like flowerhead 7–10 cm across, broad orange ray florets surrounding a domed yellow-orange disc, hollow stem swelling below each head, large rough dark green leaves, bold tropical garden presence",
    "seed": "seed ripening: branching stems 100–120 cm, petals fallen, spent flowerheads forming cylindrical seed receptacles, leaves yellowing and wilting, natural late-season character",
    "dried": "winter standing structure: fully dried branching stems 90–110 cm tall, the hollow stems pale tan-brown, cylindrical dried seed heads at branch tips, no foliage remaining, bold architectural skeletal structure",
  },
  "artichoke": {
    "sprout": "early spring emergence: a bold rosette 20–30 cm tall just emerging from soil, large deeply pinnately lobed leaves with wavy lacy margins, silvery grey-green above with densely white-felty undersides, leaves spreading wide, lobes slightly spiny, no flower stems yet, rooted in a substantial mound of dark garden soil, dramatic early presence",
    "foliage": "spring vegetative growth: a magnificent large rosette 60–80 cm tall, huge deeply pinnately lobed arching leaves 60–100 cm long, upper surface grey-green to glaucous-green, underside densely white-felty, margins spiny-lobed, leaves arching outward and upward, no flower stems yet, dramatic architectural garden presence",
    "bloom": "full bloom: a tall plant 140–160 cm, several upright stout stems each bearing large rounded artichoke heads 8–12 cm across with overlapping fleshy grey-green bracts tightly closed, the topmost head largest, lower side stems bearing smaller heads, large silvery grey-green leaves below, majestic architectural garden presence",
    "seed": "seed ripening: tall stems 130–150 cm, the largest artichoke heads opened fully into large thistle flowerheads 10–15 cm across with masses of silky purple tubular florets and silky pappus, some heads already seeding with silky white down, grey-green leaves below, dramatic late-summer character",
    "dried": "winter standing structure: several fully dried stout stems 120–150 cm tall, the large dried thistle heads 8–12 cm across persistent and decorative, stems pale buff-brown, no foliage remaining, spectacular architectural winter silhouette",
  },
  "achillea": {
    "sprout": "early spring emergence: a small rosette 10–15 cm tall of feathery aromatic grey-green leaves just emerging, leaves finely bipinnately divided giving a fern-like texture, surface finely hairy, aromatic, no upright stems yet, rooted in a small mound of dark garden soil",
    "foliage": "spring vegetative growth: a lush upright clump 40–60 cm tall, several stems densely clothed in ferny bipinnately divided grey-green leaves, surface finely hairy, aromatic, no flowerheads yet, vigorous garden habitus",
    "bloom": "full bloom: a tall upright plant 90–100 cm, several stiff upright stems each topped with a broad flat corymb 8–12 cm across of tiny golden-yellow flowers, the flat-topped heads composed of many small individual florets, ferny grey-green aromatic foliage along stems, bold long-lasting summer presence",
    "seed": "seed ripening: upright stems 85–95 cm, the flat corymbs now fading from gold to buff, seeds maturing in the small dried receptacles, ferny foliage yellowing and dying back along lower stems, natural late-summer character",
    "dried": "winter standing structure: several fully dried upright stems 80–90 cm tall, the flat-topped papery dried seed heads persistent and buff-brown, stems stiff and pale, no foliage remaining, classic architectural winter silhouette",
  },
  "cosmea": {
    "sprout": "seedling emergence: a small clump 10–15 cm tall of delicate feathery bright green seedling leaves, leaves finely bipinnate giving a thread-like appearance, fresh bright green, slender stems, no buds yet, rooted in a small mound of dark garden soil, airy and delicate",
    "foliage": "vegetative growth: a bushy airy plant 40–60 cm tall, branching slender stems clothed in finely bipinnate bright green foliage, thread-like leaflets, delicate texture throughout, small rounded flower buds just forming at branch tips, light and airy garden habitus",
    "bloom": "full bloom: a tall airy branching plant 90–100 cm, slender stems each bearing a single large daisy-like flower 6–8 cm across, broad ray petals in soft pink to deep rose with finely toothed tips, surrounding a small bright yellow disc, finely bipinnate bright green feathery foliage, charming romantic garden presence",
    "seed": "seed ripening: tall airy branching stems 80–90 cm, flowerheads replaced by slender radiating achenes 1–1.5 cm long spreading from a central receptacle like a starburst, feathery foliage yellowing, natural autumn character",
    "dried": "late season: fully dried airy skeletal branching stems 70–80 cm tall, the fine dried seed heads still radiating, stems pale tan, no foliage remaining, delicate skeletal structure",
  },
  "paeonia": {
    "sprout": "early spring emergence: a dramatic clump of emerging shoots 15–20 cm tall, stout stems deep burgundy-red to dark red-purple, leaves still partly enclosed in the unfolding growth, leaflet tips just showing, surface smooth and glossy, rooted in a substantial mound of dark garden soil, striking early spring presence",
    "foliage": "late spring vegetative growth: a lush bushy mound 50–70 cm tall, compound leaves on upright red-green stems, each leaf divided into several ovate dark glossy green leaflets, smooth surface, several large rounded tightly closed buds 3–5 cm across on stem tips beginning to show pink, lush and anticipatory garden habitus",
    "bloom": "full bloom: a lush bushy plant 70–80 cm tall, large multi-petalled flowers 10–15 cm across in deep pink to blush-white fully open at stem tips, petals numerous and ruffled, some flowers still cupped, glossy dark green compound foliage below, stems sturdy, soil mound at base, sumptuous classic garden presence",
    "seed": "seed ripening: upright stems 65–75 cm, flowers replaced by large star-shaped follicle pods 4–6 cm across splitting open along their length to reveal dark seeds, some pods still green, others opening, glossy dark green compound foliage still present, natural late-summer character",
    "dried": "autumn standing: dried brown stems 50–60 cm tall, open star-shaped pods with brown leathery walls revealing dark seeds inside, all foliage gone, stems pale brown, rooted in a mound of dark soil, sculptural autumn garden character",
  },
  "artemisia": {
    "sprout": "early spring emergence: a small clump 10–15 cm tall of silky deeply divided aromatic leaves emerging from the soil, leaves finely lobed and covered in dense silky white-silver hairs giving a striking silvery appearance, intensely aromatic, no upright stems yet, rooted in a small mound of dark garden soil",
    "foliage": "late spring vegetative growth: a bushy mound 40–60 cm tall of deeply bipinnately divided silvery-grey aromatic foliage, stems upright and branching, leaves covered in dense silky silvery hairs, softly luminous silver-grey colour, intensely aromatic, no flower stems yet, striking architectural garden habitus",
    "bloom": "late summer bloom: an upright plant 80–90 cm tall, numerous upright branching stems clothed in silvery aromatic foliage, the upper stems bearing slender drooping sprays of tiny yellow button flowers 3–4 mm across in loose panicles, silver foliage and small yellow flowers in elegant combination, characteristic wormwood garden presence",
    "seed": "seed ripening: upright branching stems 70–80 cm, the flower sprays dried to buff-grey with tiny dried seed capsules, silvery foliage fading and becoming greyer, natural late-season character",
    "dried": "winter standing: a low woody mound 30–35 cm tall, gnarled silvery-grey woody stems visible, sparse persistent small silvery-grey leaves at branch tips, some stems bare, the woody skeletal structure of the plant revealed, quiet architectural winter habitus",
  },
  "lactuca": {
    "sprout": "early spring emergence: a small basal rosette 10–15 cm tall, leaves deeply pinnately lobed with spiny-toothed margins and a row of spines along the midrib on the underside, blue-green to grey-green, slightly glaucous, compass plant character with leaves beginning to orient vertically, rooted in a small mound of dark soil",
    "foliage": "vegetative growth: a tall upright stem 40–70 cm, leaves clasping the stem, deeply lobed and spiny-edged, blue-green, the leaves distinctively oriented vertically edge-on, no flowers yet, singular architectural character",
    "bloom": "full bloom: a tall branching stem 100–120 cm, numerous small pale yellow flower heads 1–1.5 cm across in branching panicles, each resembling a miniature dandelion, blue-green lobed leaves along the lower stem, tall airy branching top, characteristic composite wildflower presence",
    "seed": "seed ripening: a tall branching stem 100–115 cm, the small flowerheads replaced by fluffy white dandelion-like seed heads 2–3 cm across, seeds dispersing on white silky pappus, lower leaves yellowing and dying, delicate and transient",
    "dried": "winter standing: a fully dried tall branching stem 90–110 cm, the branching structure pale buff-brown and skeletal, dried empty seed receptacles along the branches, no foliage remaining, tall elegant skeletal winter silhouette",
  },
  "nasturtium": {
    "sprout": "seedling emergence: a small clump 10–15 cm tall, a few round shield-shaped bright green leaves 3–5 cm across on short upright stems, leaves peltate with the stem attached at the centre, entire smooth margin, slightly glaucous surface, no flowers yet, rooted in a small mound of dark garden soil",
    "foliage": "vegetative growth: a mounding trailing clump 30–40 cm tall, many large round bright green peltate leaves 5–10 cm across on sprawling stems, leaf veins radiating from the central stem attachment, no flowers yet, lush and exuberant garden habitus",
    "bloom": "full bloom: a mounding trailing plant 40–50 cm tall, large round bright green peltate leaves everywhere, numerous funnel-shaped spurred flowers 4–6 cm across in vivid orange, each with five slightly ruffled petals and a spur 2–3 cm long, flowers standing above the foliage, bold and colourful summer presence",
    "seed": "seed ripening: trailing stems with yellowing round leaves and wrinkled round bumpy seed pods 1–1.5 cm across in clusters of 3, pods green to yellow-green, foliage beginning to collapse, natural autumn character",
    "dried": "late season: dried trailing stems with dried papery seed pods, no foliage remaining, light skeletal structure",
  },
  "nicotiana": {
    "sprout": "seedling emergence: a small rosette 10–15 cm tall of large soft pale green leaves, leaves slightly sticky and glandular-hairy, oval to oblong, margins entire, no upright stems yet, rooted in a small mound of dark garden soil",
    "foliage": "vegetative growth: a rosette 30–40 cm tall of large soft pale green leaves on short stems, leaves 10–20 cm long, oval to oblong, glandular-sticky surface, pale mid-green, no flower stems yet, lush and velvety garden habitus",
    "bloom": "full bloom: a tall branching sticky plant 90–100 cm, numerous slender branching sticky stems bearing loose clusters of small white tubular flowers 2–3 cm long with spreading lobes, flowers opening in the evening, large pale green basal leaves below, delicate evening garden presence",
    "seed": "seed ripening: tall branching stems 80–90 cm with small oval 2-lobed seed capsules 5–8 mm long in place of each flower, basal leaves yellowing, natural autumn character",
    "dried": "late season: fully dried branching stems 60–70 cm, the small dried seed capsules persistent along stems, stems pale tan, no foliage remaining, fine skeletal structure",
  },
  "atriplex": {
    "sprout": "seedling emergence: a small clump 10–15 cm tall of deep burgundy-red arrow-shaped seedling leaves with a mealy surface texture characteristic of the genus, dramatic dark red-purple colour throughout, no upright flower stems yet, rooted in a small mound of dark garden soil, striking early colour",
    "foliage": "vegetative growth: an upright plant 40–60 cm tall, several upright stems bearing large arrow-shaped to triangular leaves 5–12 cm long, deep burgundy-red to dark red-purple throughout, mealy surface, stems stout and red, no flower spikes yet, dramatic architectural garden presence",
    "bloom": "full bloom: a tall upright branching plant 120–130 cm, numerous slender upright branches bearing small reddish flower spikes among the deep red arrow-shaped foliage, overall plant dramatically dark red and architectural, unique late-summer presence",
    "seed": "seed ripening: tall upright stems 115–125 cm densely covered in papery triangular seed bracts 5–8 mm long in whorls, bracts reddish-brown to buff, foliage below fading and sparse, ornamental seed effect",
    "dried": "late season: fully dried reddish-brown skeletal stems 100–115 cm, the papery seed bracts persistent, stems buff-brown, no foliage remaining, distinctive architectural skeletal structure",
  },
  "borago": {
    "sprout": "seedling emergence: a small clump 10–15 cm tall of large oval rough grey-green leaves, surface covered in coarse white bristles giving a distinctly rough-hairy texture, leaves 5–10 cm long, softly grey-green due to the dense bristles, no flower stems yet, rooted in a small mound of dark garden soil",
    "foliage": "vegetative growth: a bushy clump 25–35 cm tall, large oval rough bristly grey-green leaves on branching hairy stems, leaves 8–15 cm, surface densely covered in stiff white bristles, stems also bristly, coiled flower buds beginning to form, vigorous garden habitus",
    "bloom": "full bloom: a bushy branching plant 50–60 cm tall, numerous nodding star-shaped flowers 2–3 cm across, petals a striking sky-blue with a distinctive pointed cone of black anthers at the centre, flowers in nodding clusters at branch tips, large rough grey-green bristly leaves below, charming cottage garden character",
    "seed": "seed ripening: branching stems 45–55 cm, star-shaped persistent calyces bearing 1–4 small brown nutlet seeds within each, leaves yellowing and wilting, natural late-summer character",
    "dried": "late season: fully dried brittle branching stems 35–40 cm, the empty star-shaped calyces decorative and persistent, stems pale tan, no foliage remaining, delicate skeletal structure",
  },
  "symphytum": {
    "sprout": "early spring emergence: a substantial clump 15–20 cm tall of large broad dark green leaves emerging from soil, leaves 15–20 cm long, oval to lanceolate, surface rough with coarse white bristles, the decurrent leaf base running down the stem as a wing, no flower stems yet, rooted in a large mound of dark garden soil, bold spring emergence",
    "foliage": "vegetative growth: a bold lush clump 40–60 cm tall, several upright branching stems densely clothed in large rough dark green hairy leaves 20–35 cm long, the leaves decurrent with wings running down the stem, surfaces rough and bristly, no flowers yet, bold and lush garden habitus",
    "bloom": "full bloom: an upright branching plant 80–90 cm tall, numerous upright stems each tipped with nodding scorpioid cymes uncurling to reveal tubular bell-shaped flowers 1.5–2 cm long in creamy-white to pale purple, flower buds in tight coils unrolling, large rough hairy leaves below, vigorous and generous garden presence",
    "seed": "seed ripening: upright branching stems 70–80 cm, cymes straightened bearing 4 small black nutlet seeds in persistent calyces at each flower position, large hairy leaves yellowing and beginning to flop, natural summer character",
    "dried": "winter dormancy: plant fully died back, bare soil with a few remnant dried broken stem bases 5–10 cm tall at ground level, no above-ground green growth, dark mound of soil, natural winter dormancy",
  },
  "diplotaxis": {
    "sprout": "early spring emergence: a small basal rosette 5–10 cm tall, leaves pinnately lobed with rounded lobes, dark green, surface smooth to slightly hairy, margins deeply cut, no upright stems yet, rooted in a small mound of dark soil, delicate small-scale character",
    "foliage": "spring vegetative growth: a basal rosette 15–20 cm tall with more fully developed pinnately lobed dark green leaves 5–10 cm long, several slender upright stems just beginning to rise, no flowers yet, neat and delicate character",
    "bloom": "full bloom: an upright branching plant 40–45 cm tall, slender stems bearing small bright yellow four-petalled cross-shaped flowers 1–1.5 cm across at tips, long narrow silique pods 2–4 cm already forming below each flower, pinnately lobed basal rosette, natural wildflower character",
    "seed": "seed ripening: upright branching stems 35–40 cm densely lined with long narrow silique pods 2–4 cm long pointing upward, pods green to yellow-brown, basal leaves yellowing and dying, natural late-summer character",
    "dried": "winter standing: fully dried slender skeletal branching stems 30–35 cm, the empty split silique pods still attached, stems pale tan, no foliage remaining, fine delicate skeletal structure",
  },
  "beta": {
    "sprout": "seedling emergence: a small seedling 10–15 cm tall, rounded cotyledons and first glossy crinkled true leaves, stems reddish, leaves dark green with prominent pale midribs, fresh young garden growth, rooted in a small mound of dark garden soil",
    "foliage": "vegetative growth: a full leafy plant 40–60 cm tall, large glossy crinkled dark green leaves 20–35 cm long with very prominent thick white midribs and white leaf stems standing upright and spreading, leaves bold and glossy, no flower spikes yet, robust and lush garden habitus",
  },
  "verbascum": {
    "sprout": "early spring emergence: a low basal rosette 15–25 cm tall of large dark green softly hairy leaves just emerging, leaves ovate to oblong 15–25 cm long, surface covered with short soft hairs, dark green above, paler below, no flower spike yet, rooted in a substantial mound of dark garden soil",
    "foliage": "spring vegetative growth: a full basal rosette 30–40 cm tall of large dark green softly hairy leaves 20–30 cm long, broadly oval with crenated margins, the dark green upper surface contrasting with paler woolly undersides, no flower spike yet, handsome rosette habitus",
    "bloom": "full bloom: a tall slender plant 100–120 cm, a single slender upright spike rising from the basal rosette densely set with small yellow flowers 1.5–2 cm across, each with 5 yellow petals and distinctive purple-hairy stamens in the centre, flowers arranged continuously along the spike, large dark green basal rosette visible below, elegant vertical garden presence",
    "seed": "seed ripening: tall upright spike 100–115 cm, the flower spike now bearing small round ovoid seed capsules 5–7 mm at every flower node, spike tightly packed with seed capsules, basal rosette yellowing and declining, natural late-summer character",
    "dried": "winter standing structure: a single fully dried upright spike 100–110 cm tall, the spike densely covered with persistent small round seed capsules, stem pale straw-brown, no foliage remaining, elegant architectural winter silhouette",
  },
  "fennel": {
    "sprout": "early spring emergence: a small delicate clump 10–15 cm tall of feathery thread-like bright green leaves, leaves finely divided into hair-like segments, anise-scented, fresh vivid green, no upright stems yet, rooted in a small mound of dark garden soil, delicate feathery character",
    "foliage": "vegetative growth: a tall upright clump 80–120 cm of hollow blue-green stems bearing masses of feathery thread-like foliage finely divided to hair-like segments, stems round and hollow, glaucous blue-green, anise-scented foliage, no flowers yet, cloud-like feathery garden habitus",
    "bloom": "full bloom: a very tall plant 160–180 cm, tall hollow blue-green stems topped with large flat umbels 10–15 cm across of tiny bright yellow flowers in compound umbels of 20–40 rays, feathery thread-like foliage below, bold architectural summer presence",
    "seed": "seed ripening: tall hollow stems 150–170 cm, the flat umbels bearing dense clusters of small oblong fennel achenes 4–6 mm long ripening from green to grey-brown, feathery foliage yellowing and dying, natural late-summer character",
    "dried": "winter standing structure: tall hollow dried stems 140–160 cm pale straw-tan, the flat dried seed umbels at the top, the branching structure of the umbels clear and architectural, no foliage remaining, elegant botanical winter silhouette",
  },
  "mentha": {
    "sprout": "early spring emergence: fresh young mint shoots 10–15 cm tall emerging from soil, bright green crinkled aromatic leaves in opposite pairs, leaves lance-shaped 2–4 cm long with toothed margins, veins prominent, intensely spearmint-scented, vigorous new growth from underground runners, rooted in a small mound of dark garden soil",
    "foliage": "late spring vegetative growth: a lush upright clump 30–50 cm tall, multiple erect square stems densely clothed in bright green lance-shaped crinkled leaves 4–7 cm long in opposite pairs, leaf margins toothed, surface slightly crinkled and aromatic, no flower spikes yet, vigorous spreading mint habitus",
    "bloom": "full bloom: an upright clump 55–65 cm tall, square stems topped with slender whorled flower spikes 4–8 cm long, each with whorls of tiny lilac-pink to pale purple flowers closely arranged along the spike, bright green aromatic foliage below the spikes, typical spearmint character",
    "seed": "late season: upright stems 50–55 cm, the spent whorled flower spikes turned brown with tiny nutlet seeds in each calyx, leaves yellowing and wilting, natural end-of-season habitus",
    "dried": "winter standing: dried upright square stems 40–45 cm, the spent brown flower spikes persistent along stem tips, no leaves remaining, skeletal winter structure",
  },
  "calendula_arvensis": {
    "sprout": "early spring seedling: a tiny seedling 5–10 cm tall, a small low rosette of pale green slightly sticky aromatic leaves, leaves spoon-shaped to oblong, surface slightly glandular, no stems yet, rooted in a small mound of dark soil, small-scale delicate character",
    "foliage": "vegetative growth: a low spreading plant 15–20 cm tall, pale green aromatic leaves on branching spreading stems, leaves oblong to spoon-shaped slightly sticky, margins slightly wavy, small rounded buds just beginning to form at tips, compact field-flower character",
    "bloom": "full bloom: a low spreading plant 25–30 cm tall, many branching stems each bearing a small bright orange-yellow daisy-like flowerhead 2–3 cm across, ray florets narrower and fewer than garden marigold, pale green aromatic leaves, continuous natural wildflower character",
    "seed": "seed ripening: spreading stems 20–25 cm with small distinctive rings of curved hook-shaped achenes 8–12 mm long replacing each flowerhead, foliage yellowing and sparse, natural autumn character",
  },
  "fagopyrum": {
    "sprout": "seedling emergence: a small dense cluster of seedlings 5–10 cm tall, rounded cotyledons spread wide on short reddish stems, first heart-shaped true leaves emerging, fresh bright green with reddish stem coloration, rooted in a small mound of dark garden soil",
    "foliage": "vegetative growth: a natural clump of upright branching plants 30–50 cm tall, heart-shaped to triangular bright green leaves 4–8 cm wide on reddish stems, leaf base sagittate, smooth surface, no flowers yet, vigorous upright branching habitus",
    "bloom": "full bloom: a clump 60–70 cm tall, branching reddish stems densely covered in clusters of tiny white to soft blush-pink five-petalled flowers 3–5 mm across at every stem tip, the whole plant appearing to float in a cloud of small flowers, heart-shaped leaves between the flower clusters, outstanding pollinator plant presence",
    "seed": "seed ripening: branching stems 55–65 cm turning from green to brown, dense clusters of distinctive three-winged triangular dark brown achenes 5–6 mm long replacing each flower cluster, some leaves yellowing, natural harvest character",
  },
  "brassica_sabellica": {
    "sprout": "seedling emergence: a small seedling 8–12 cm tall, a pair of rounded blue-green cotyledons on short stems and first crinkled true leaves emerging, leaves deeply blistered and curled, blue-green colour, rooted in a small mound of dark garden soil, fresh brassica character",
    "foliage": "mature vegetative growth: a mature kale plant 60–75 cm tall, a thick central stem bearing large deeply crinkled and curled leaves fanning outward, leaves 40–60 cm long, deeply blistered blue-green to dark green, ruffled and curled especially at margins, stems and midribs robust and pale, robust cold-hardy garden habitus",
    "bloom": "spring bolting: a bolting second-year plant 90–100 cm tall, tall branching stems rising from a few remaining basal blue-green leaves, branch tips bearing loose corymbs of bright yellow four-petalled crucifer flowers 1.5–2 cm across, classic spring bolting habitus",
  },
}

COMMON_NAMES = {
  "echinacea": "purple coneflower",
  "poppy": "Oriental poppy",
  "sunflower": "common sunflower",
  "bunias": "Turkish warty-cabbage",
  "aquilegia": "common columbine",
  "primula": "cowslip",
  "phacelia": "tansy phacelia",
  "calendula": "pot marigold",
  "anthemis": "golden marguerite",
  "tithonia": "Mexican sunflower",
  "artichoke": "globe artichoke",
  "achillea": "fern-leaf yarrow",
  "cosmea": "garden cosmos",
  "paeonia": "Chinese peony",
  "artemisia": "wormwood",
  "lactuca": "prickly lettuce",
  "nasturtium": "garden nasturtium",
  "nicotiana": "ornamental tobacco",
  "atriplex": "red orache",
  "borago": "borage",
  "symphytum": "common comfrey",
  "diplotaxis": "wall rocket",
  "beta": "Swiss chard",
  "verbascum": "dark mullein",
  "fennel": "common fennel",
  "mentha": "spearmint",
  "calendula_arvensis": "field marigold",
  "fagopyrum": "common buckwheat",
  "brassica_sabellica": "curly kale",
}

data = json.loads(SPECIES_JSON.read_text())

updated = 0
for plant in data:
    slug = plant["slug"]
    if slug not in PROMPTS:
        continue
    common = COMMON_NAMES.get(slug, "")
    prefix = PREFIX.format(name=plant["name"], common=common)
    stage_prompts = PROMPTS[slug]
    for stage in plant["stages"]:
        sid = stage["id"]
        if sid in stage_prompts:
            stage["prompt"] = prefix + stage_prompts[sid]
            updated += 1

SPECIES_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2))
print(f"Updated {updated} prompts across {len(PROMPTS)} plants.")
