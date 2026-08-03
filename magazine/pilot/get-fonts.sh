#!/bin/sh
set -e
cd "$(dirname "$0")"
mkdir -p fonts
curl -sSL -o "fonts/Defectica.woff" "https://static.tildacdn.com/tild3362-3931-4232-b064-666436323663/Defectica.woff"
curl -sSL -o "fonts/Polonium.woff" "https://static.tildacdn.com/tild6262-3035-4033-a365-383234333234/Polonium.woff"
curl -sSL -o "fonts/Santa-Catarina.woff" "https://static.tildacdn.com/tild6264-3035-4965-b538-333966626230/Santa-Catarina.woff"
curl -sSL -o "fonts/PlayfairDisplaySC-Re.woff" "https://static.tildacdn.com/tild3062-3735-4261-b961-393833343265/PlayfairDisplaySC-Re.woff"
curl -sSL -o "fonts/AnticDidone-Regular.woff" "https://static.tildacdn.com/tild3931-6238-4231-a266-383035386261/AnticDidone-Regular.woff"
curl -sSL -o "fonts/RobotoSlab-VariableF.woff" "https://static.tildacdn.com/tild6137-6463-4564-b638-666332636435/RobotoSlab-VariableF.woff"
curl -sSL -o "fonts/PFRegalDisplayPro-UB.woff" "https://static.tildacdn.com/tild3461-3164-4063-a632-383661646363/PFRegalDisplayPro-UB.woff"
curl -sSL -o "fonts/Polonium-Bold.woff" "https://static.tildacdn.com/tild3332-3333-4835-a532-613339643163/Polonium-Bold.woff"
curl -sSL -o "fonts/drukwidecyr-bold.woff2" "https://static.tildacdn.com/tild3432-3265-4532-b237-326436336265/drukwidecyr-bold.woff2"
echo 'Шрифты загружены:'
ls -la fonts
