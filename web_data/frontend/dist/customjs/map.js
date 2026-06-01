document.addEventListener('DOMContentLoaded', function () {
			new jsVectorMap({
				selector: '#map',
				map: 'us_mill_en',
				zoomButtons: true,
				zoomOnScroll: true,
			});
		});