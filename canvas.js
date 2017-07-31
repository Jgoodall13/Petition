const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");

$('#canvas').on('mousedown', function(e){
    e.preventDefault();
    context.moveTo(e.pageX - this.offsetLeft, e.pageY - this.offsetTop);
    $('#canvas').on('mousemove', function(e){
        context.lineTo(e.pageX - this.offsetLeft, e.pageY - this.offsetTop);
        context.stroke();
    }).on('mouseup', function(){
        $('#canvas').off('mousemove');
        $('#hiddencanvas').val(canvas.toDataURL());
        console.log(canvas.toDataURL());
    });
});
