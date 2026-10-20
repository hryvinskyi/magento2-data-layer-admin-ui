<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Form;

use Magento\Framework\Data\Form\Element\AbstractElement;

/**
 * Reads another setting of the same settings section, as the form shows it for the scope being edited
 *
 * The form holds each setting's value for the scope: the scope's own, or the one it inherits. A read-only field reads
 * its neighbours there instead of loading the configuration again.
 */
class SectionValues
{
    /**
     * Get the value of another setting of the element's section
     *
     * @param AbstractElement $element A field of the section
     * @param string $path The setting's group and field, for example `gtm/container_id`
     * @return mixed Null when the form shows no such setting
     */
    public function value(AbstractElement $element, string $path): mixed
    {
        $config = $element->getData('field_config');
        $fieldPath = is_array($config) && is_string($config['path'] ?? null) ? $config['path'] : '';
        $section = strstr($fieldPath, '/', true);
        if ($section === false || $section === '') {
            return null;
        }
        $sibling = $element->getForm()->getElement($section . '_' . str_replace('/', '_', $path));

        return $sibling instanceof AbstractElement ? $sibling->getData('value') : null;
    }
}
