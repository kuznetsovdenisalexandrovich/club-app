/* One motion profile for all club cards and the editor preview. */
window.ClubCardMotion=Object.freeze({tilt:9.6,smooth:0.216,range:15});
window.withClubCardMotion=function(settings){return Object.assign({},settings||{},window.ClubCardMotion)};
