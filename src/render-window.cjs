// Overscan prevents React work for every small camera movement.
function level(scale){return scale<.35?'overview':scale<.65?'compact':'detail';}
function windowFor(camera,width,height){
  const pad=240/camera.scale;
  return {level:level(camera.scale),left:-camera.x/camera.scale-pad,top:-camera.y/camera.scale-pad,right:(width-camera.x)/camera.scale+pad,bottom:(height-camera.y)/camera.scale+pad};
}
function contains(view,camera,width,height){return view.level===level(camera.scale)&&-camera.x/camera.scale>=view.left&&-camera.y/camera.scale>=view.top&&(width-camera.x)/camera.scale<=view.right&&(height-camera.y)/camera.scale<=view.bottom;}
function intersects(view,left,top,right,bottom){return right>=view.left&&left<=view.right&&bottom>=view.top&&top<=view.bottom;}
function nodeBox(p){const left=Math.min(p.x-p.radius,p.cardX),right=Math.max(p.x+p.radius,p.cardX+p.cardWidth);return {left,right,top:p.y-18,bottom:p.y+18,cx:(left+right)/2,cy:p.y,width:right-left,height:36};}
function nodeVisible(view,p){const b=nodeBox(p);return intersects(view,b.left,b.top,b.right,b.bottom);}
function edgeVisible(view,c){const a=nodeBox(c.from),b=nodeBox(c.to);return intersects(view,Math.min(a.left,b.left),Math.min(a.top,b.top),Math.max(a.right,b.right),Math.max(a.bottom,b.bottom));}
function edgePath(a,b){const x=nodeBox(a).left+14,y=nodeBox(b).left+14,dx=y-x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(!length)return '';const radius=p=>['user','context','system'].includes(p.kind)?9:6;return `M ${x+dx*radius(a)/length} ${a.y+dy*radius(a)/length} L ${y-dx*radius(b)/length} ${b.y-dy*radius(b)/length}`;}
module.exports={level,windowFor,contains,nodeBox,nodeVisible,edgeVisible,edgePath};
