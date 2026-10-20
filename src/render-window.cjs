// Overscan prevents React work for every small camera movement.
function level(scale){return scale<.35?'overview':scale<.65?'compact':'detail';}
function windowFor(camera,width,height){
  const pad=240/camera.scale;
  return {level:level(camera.scale),left:-camera.x/camera.scale-pad,top:-camera.y/camera.scale-pad,right:(width-camera.x)/camera.scale+pad,bottom:(height-camera.y)/camera.scale+pad};
}
function contains(view,camera,width,height){return view.level===level(camera.scale)&&-camera.x/camera.scale>=view.left&&-camera.y/camera.scale>=view.top&&(width-camera.x)/camera.scale<=view.right&&(height-camera.y)/camera.scale<=view.bottom;}
function intersects(view,left,top,right,bottom){return right>=view.left&&left<=view.right&&bottom>=view.top&&top<=view.bottom;}
function nodeVisible(view,p){return intersects(view,Math.min(p.x-p.radius,view.level==='detail'?p.cardX:p.x),p.y-Math.max(18,p.radius),Math.max(p.x+p.radius,view.level==='detail'?p.cardX+p.cardWidth:p.x),p.y+Math.max(18,p.radius));}
function edgeVisible(view,c){return intersects(view,Math.min(c.from.x,c.to.x),Math.min(c.from.y,c.to.y),Math.max(c.from.x,c.to.x),Math.max(c.from.y,c.to.y));}
module.exports={level,windowFor,contains,nodeVisible,edgeVisible};
