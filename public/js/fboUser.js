const valid = () =>{
    const dateOfPickup = new Date($('input[name="dateOfPickup"]').val());
    return $('input[name="oilAmount"]').val() >=50 && dateOfPickup>=new Date();
}