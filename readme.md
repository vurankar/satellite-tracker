A simple express app to implement APIs to get satellite information.
See (http://www.celestrak.com/NORAD/elements/visual.txt) for list of 100 brighest satellites.

Implements following APIs:
1. /nextVisible: Returns next time the given satellite is visible from given location.

Eg: localhost:3000/nextVisible?longitude=37.401014&latitude=-122.0594347&name=ISIS

2. /brighest: Which satellite (amongst celestrak's 100 brighest) will be overhead at the give location at given time. 

Eg: localhost:3000/brighest?longitude=37.401014&latitude=-122.0594347&date=2020-12-22 18:28:15 GMT-0800

3. /satellitePasses: How many times will each of the celestrak's 100 brighest satellite pass over given location in next 24 hours. Also returns the visible windows

Eg: localhost:3000/satellitePasses?longitude=37.401014&latitude=-122.0594347