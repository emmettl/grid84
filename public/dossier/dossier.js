/* Filter the claims by evidence tier. Nothing else on the page needs script. */
(function(){
  var body = document.body;
  var btns = Array.prototype.slice.call(document.querySelectorAll('.fbtn[data-t]'));
  var clear = document.getElementById('clearf');
  var claims = Array.prototype.slice.call(document.querySelectorAll('.claim'));
  var active = {};

  function apply(){
    var keys = Object.keys(active).filter(function(k){ return active[k]; });
    if (keys.length === 0){
      body.classList.remove('filtering');
      claims.forEach(function(c){ c.classList.remove('on'); });
      clear.setAttribute('aria-pressed','false');
      return;
    }
    body.classList.add('filtering');
    claims.forEach(function(c){
      var match = keys.some(function(k){ return c.classList.contains(k); });
      c.classList.toggle('on', match);
    });
    clear.setAttribute('aria-pressed','false');
  }

  btns.forEach(function(b){
    b.addEventListener('click', function(){
      var t = b.getAttribute('data-t');
      active[t] = !active[t];
      b.setAttribute('aria-pressed', active[t] ? 'true' : 'false');
      apply();
    });
  });

  clear.addEventListener('click', function(){
    active = {};
    btns.forEach(function(b){ b.setAttribute('aria-pressed','false'); });
    apply();
  });
})();
