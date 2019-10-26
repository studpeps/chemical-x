const valid = () =>{
    if($('input[name="password"]').val() == $('input[name="checkPassword"]').val()){
        $('.passwordWarning').slideUp();
        return true;
    }else{
        $('.passwordWarning').slideDown();
        return false;
    }
}